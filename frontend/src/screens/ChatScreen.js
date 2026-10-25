import styles from '../styles/ChatScreenStyles';
import { useEffect, useId, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '../components/BrandMark';
import { ProductCard } from '../components/ProductCard';
import { streamChat } from '../services/chatService';
import { getPolicyManualUrl } from '../services/policyService';
import {
  createConversation,
  getConversationTitle,
  loadConversations,
  saveConversations,
} from '../services/chatStorage';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const suggestions = [
  'Hi! What can you help me with?',
  'Can I return a defective graphics card?',
  'How much is delivery to Chattogram?',
];

function ThinkingIndicator({ message }) {
  const [dots] = useState(() => [
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]);

  useEffect(() => {
    const loops = dots.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(value, {
            toValue: 1,
            duration: 240,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 240,
            useNativeDriver: true,
          }),
          Animated.delay(300),
        ]),
      ),
    );
    loops.forEach((animation) => animation.start());
    return () => loops.forEach((animation) => animation.stop());
  }, [dots]);

  return (
    <View style={styles.thinking}>
      <Text style={styles.typingText}>{message || 'Thinking'}</Text>
      <View style={styles.thinkingDots}>
        {dots.map((value, index) => (
          <Animated.View
            key={index}
            style={[
              styles.thinkingDot,
              {
                opacity: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.35, 1],
                }),
                transform: [{
                  translateY: value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -3],
                  }),
                }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export function ChatScreen() {
  const messageIdPrefix = useId();
  const { addItem } = useCart();
  const { token, customer } = useAuth();
  const customerId = customer?.id;
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [historyVisible, setHistoryVisible] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [loadedCustomerId, setLoadedCustomerId] = useState(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const listRef = useRef(null);
  const mountedRef = useRef(true);
  const activeCustomerIdRef = useRef(customerId);
  const requestControllerRef = useRef(null);
  const busyRef = useRef(false);
  const messageSequenceRef = useRef(0);
  const activeConversation = conversations.find(({ id }) => id === activeId);
  const messages = activeConversation?.messages || [];

  useEffect(() => {
    mountedRef.current = true;
    activeCustomerIdRef.current = customerId;
    let active = true;
    if (!customerId) {
      return () => {
        active = false;
        mountedRef.current = false;
      };
    }
    loadConversations(customerId)
      .then((saved) => {
        if (!active) return;
        setConversations(saved);
        setActiveId(saved[0]?.id || null);
      })
      .catch((reason) => {
        console.warn('Could not restore chat history:', reason);
      })
      .finally(() => {
        if (active) {
          setLoadedCustomerId(customerId);
          setStorageReady(true);
        }
      });
    return () => {
      active = false;
      mountedRef.current = false;
      requestControllerRef.current?.abort();
    };
  }, [customerId]);

  useEffect(() => {
    if (!storageReady || !customerId || loadedCustomerId !== customerId) return;
    saveConversations(conversations, customerId).catch((reason) =>
      console.warn('Could not save chat history:', reason),
    );
  }, [conversations, customerId, loadedCustomerId, storageReady]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const updateConversation = (id, update) => {
    setConversations((current) =>
      current
        .map((conversation) =>
          conversation.id === id ? update(conversation) : conversation,
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 30),
    );
  };

  const startNewChat = () => {
    if (busyRef.current) return;
    const conversation = createConversation();
    setConversations((current) => [conversation, ...current].slice(0, 30));
    setActiveId(conversation.id);
    setDraft('');
    setError('');
    setHistoryVisible(false);
  };

  const clearChat = () => {
    if (!activeConversation || busyRef.current) return;
    Alert.alert(
      'Clear this chat?',
      'Messages will be removed from this conversation. Other chats will stay saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear chat',
          style: 'destructive',
          onPress: () => {
            updateConversation(activeConversation.id, (conversation) => ({
              ...conversation,
              title: 'New chat',
              messages: [],
              updatedAt: new Date().toISOString(),
            }));
            setError('');
          },
        },
      ],
    );
  };

  const deleteConversation = (conversation) => {
    if (busyRef.current) return;
    Alert.alert(
      'Delete this chat?',
      'This conversation and its messages will be permanently removed from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const remaining = conversations.filter(({ id }) => id !== conversation.id);
            setConversations(remaining);
            if (activeId === conversation.id) {
              setActiveId(remaining[0]?.id || null);
              setDraft('');
            }
            setError('');
          },
        },
      ],
    );
  };

  const ask = async (value = draft) => {
    const question = value.trim();
    if (!question || busyRef.current || !storageReady || !token || !customerId) return;
    busyRef.current = true;
    const existing = activeConversation;
    const conversation = existing || createConversation();
    const history = conversation.messages
      .filter((message) => !message.incomplete && message.content?.trim())
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));
    messageSequenceRef.current += 1;
    const userMessage = {
      id: `${messageIdPrefix}-${messageSequenceRef.current}`,
      role: 'user',
      content: question,
      sources: [],
    };
    messageSequenceRef.current += 1;
    const assistantMessageId = `${messageIdPrefix}-${messageSequenceRef.current}`;
    const assistantPlaceholder = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      sources: [],
      progress: 'Understanding your question',
    };
    const updatedConversation = {
      ...conversation,
      title: conversation.messages.length
        ? conversation.title
        : getConversationTitle(question),
      updatedAt: new Date().toISOString(),
      messages: [...conversation.messages, userMessage, assistantPlaceholder],
    };
    if (existing) {
      updateConversation(conversation.id, () => updatedConversation);
    } else {
      setConversations((current) => [updatedConversation, ...current].slice(0, 30));
      setActiveId(conversation.id);
    }
    setDraft('');
    setBusy(true);
    setError('');

    const controller = new AbortController();
    requestControllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 125000);
    let pendingDelta = '';
    let animationFrame = null;
    const flushDelta = () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      if (!pendingDelta) return;
      const text = pendingDelta;
      pendingDelta = '';
      if (!mountedRef.current || activeCustomerIdRef.current !== customerId) return;
      updateConversation(conversation.id, (current) => ({
        ...current,
        messages: current.messages.map((message) =>
          message.id === assistantMessageId
            ? { ...message, content: message.content + text, progress: null }
            : message,
        ),
      }));
    };
    try {
      const result = await streamChat(
        { question, history, conversation_id: conversation.id },
        {
          signal: controller.signal,
          token,
          onProgress: (progress) => {
            if (!mountedRef.current || activeCustomerIdRef.current !== customerId) return;
            updateConversation(conversation.id, (current) => ({
              ...current,
              messages: current.messages.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, progress }
                  : message,
              ),
            }));
          },
          onDelta: (text) => {
            pendingDelta += text;
            if (animationFrame === null) {
              animationFrame = requestAnimationFrame(flushDelta);
            }
          },
        },
      );
      flushDelta();
      if (mountedRef.current && activeCustomerIdRef.current === customerId) {
        updateConversation(conversation.id, (current) => ({
          ...current,
          updatedAt: new Date().toISOString(),
          messages: current.messages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: result.answer,
                  progress: null,
                  sources: result.sources || [],
                  suggestedProducts: (result.suggested_products || []).map((product) => ({
                    ...product,
                    addedToCart: false,
                  })),
                }
              : message,
          ),
        }));
      }
    } catch (reason) {
      flushDelta();
      if (mountedRef.current && activeCustomerIdRef.current === customerId) {
        updateConversation(conversation.id, (current) => ({
          ...current,
          messages: current.messages
            .map((message) =>
              message.id === assistantMessageId
                ? { ...message, progress: null, incomplete: true }
                : message,
            )
            .filter(
              (message) =>
                message.id !== assistantMessageId || message.content.trim(),
            ),
        }));
        setError(
          reason.name === 'AbortError'
            ? 'The response took too long. Please try again.'
            : reason.message,
        );
      }
    } finally {
      clearTimeout(timeout);
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
      busyRef.current = false;
      if (mountedRef.current && activeCustomerIdRef.current === customerId) {
        setBusy(false);
      }
    }
  };

  const renderMessage = ({ item }) => (
    <View
      style={[
        styles.messageRow,
        item.role === 'user' ? styles.userMessageRow : styles.assistantMessageRow,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          item.role === 'user' ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        {item.content ? (
          <Text
            selectable
            style={[
              styles.messageText,
              item.role === 'user' ? styles.userText : styles.assistantText,
            ]}
          >
            {item.content}
          </Text>
        ) : null}
        {item.progress ? <ThinkingIndicator message={item.progress} /> : null}
        {item.sources?.length ? (
          <View style={styles.sources}>
            {item.sources.map((source) => (
              <Pressable
                key={source.chunkId || `${source.docId}-${source.sectionNumber}-${source.pageNumber}`}
                accessibilityRole="link"
                accessibilityLabel={`Open ${source.docTitle}, section ${source.sectionNumber}, page ${source.pageNumber || 1}`}
                onPress={() => {
                  const url = getPolicyManualUrl(source.docId, source.pageNumber);
                  if (url) {
                    Linking.openURL(url).catch((reason) =>
                      Alert.alert('Unable to open policy', reason.message),
                    );
                  }
                }}
                style={styles.sourceLink}
              >
                <Ionicons name="document-text-outline" size={13} color={colors.blue} />
                <Text style={styles.sourceText}>
                  {source.docTitle} · § {source.sectionNumber}
                  {source.pageNumber ? ` · p. ${source.pageNumber}` : ''}
                </Text>
                <Ionicons name="open-outline" size={12} color={colors.blue} />
              </Pressable>
            ))}
          </View>
        ) : null}
        {item.suggestedProducts?.map((product) => (
          <View key={product.id} style={styles.recommendedProduct}>
            <Text style={styles.recommendationLabel}>Recommended for you</Text>
            <ProductCard
              product={product}
              width={245}
              addedToCart={product.addedToCart}
              showAddLabel
              onAdd={() => {
                if (product.addedToCart || !activeConversation) return;
                const cartProduct = { ...product };
                delete cartProduct.addedToCart;
                addItem(cartProduct);
                updateConversation(activeConversation.id, (conversation) => ({
                  ...conversation,
                  messages: conversation.messages.map((message) =>
                    message.id === item.id
                      ? {
                          ...message,
                          suggestedProducts: message.suggestedProducts.map((suggested) =>
                            suggested.id === product.id
                              ? { ...suggested, addedToCart: true }
                              : suggested,
                          ),
                        }
                      : message,
                  ),
                }));
              }}
            />
            {product.addedToCart ? (
              <Text accessibilityRole="alert" style={styles.addedStatus}>
                Added to your bag
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header} onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
        <View style={styles.headerTop}>
          <BrandMark />
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setHistoryVisible(true)}
              disabled={busy}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Chat history"
            >
              <Ionicons name="time-outline" size={20} color="#FFFFFF" />
            </Pressable>
            {messages.length > 0 ? (
              <Pressable
                onPress={clearChat}
                disabled={busy}
                style={styles.headerButton}
                accessibilityRole="button"
                accessibilityLabel="Clear chat"
              >
                <Ionicons name="trash-outline" size={19} color="#FFFFFF" />
              </Pressable>
            ) : null}
            <Pressable
              onPress={startNewChat}
              disabled={busy}
              style={styles.newChatButton}
              accessibilityRole="button"
              accessibilityLabel="New chat"
            >
              <Ionicons name="create-outline" size={18} color="#FFFFFF" />
              <Text style={styles.newChatText}>New</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.kicker}>GENTECH CHAT</Text>
        <Text style={styles.title}>How can I help?</Text>
        <Text style={styles.subtitle}>
          Chat normally, or ask about Gentech’s written policies.
        </Text>
      </View>
      <KeyboardAvoidingView
        style={styles.chat}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.iconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.blue} />
            </View>
            <Text style={styles.cardTitle}>Ask me anything</Text>
            <Text style={styles.cardText}>
              I can answer Gentech policy questions and check order status for
              your signed-in account. Other customers’ order details stay private.
            </Text>
            <View style={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() => { void ask(suggestion); }}
                  style={styles.suggestion}
                  accessibilityRole="button"
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                  <Ionicons name="arrow-up-outline" size={16} color={colors.blue} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <View style={[styles.composer, keyboardVisible && styles.composerRaised]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message Gentech…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            textAlignVertical="top"
            multiline
            maxLength={2000}
            editable={!busy && storageReady}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={() => { void ask(); }}
            accessibilityLabel="Chat message"
          />
          <Pressable
            onPress={() => { void ask(); }}
            disabled={!draft.trim() || busy || !storageReady}
            style={[styles.sendButton, (!draft.trim() || busy || !storageReady) && styles.sendDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={historyVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setHistoryVisible(false)}
            accessibilityLabel="Close chat history"
          />
          <View style={styles.historySheet}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Your chats</Text>
              <Pressable
                onPress={() => setHistoryVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close chat history"
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <Pressable
              onPress={startNewChat}
              style={styles.historyNewButton}
              accessibilityRole="button"
            >
              <Ionicons name="create-outline" size={18} color={colors.blue} />
              <Text style={styles.historyNewText}>Start a new chat</Text>
            </Pressable>
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.historyEmpty}>Your saved chats will appear here.</Text>
              }
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.historyItem,
                    item.id === activeId && styles.historyItemActive,
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      setActiveId(item.id);
                      setHistoryVisible(false);
                      setError('');
                    }}
                    style={styles.historyItemSelect}
                    accessibilityRole="button"
                    accessibilityLabel={`Open chat ${item.title}`}
                  >
                    <Ionicons name="chatbubble-outline" size={17} color={colors.muted} />
                    <Text numberOfLines={1} style={styles.historyItemText}>{item.title}</Text>
                    {item.id === activeId ? (
                      <Ionicons name="checkmark" size={18} color={colors.blue} />
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={() => deleteConversation(item)}
                    disabled={busy}
                    style={styles.historyDeleteButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete chat ${item.title}`}
                  >
                    <Ionicons name="trash-outline" size={17} color={colors.red} />
                  </Pressable>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
