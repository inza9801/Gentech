import styles from '../styles/ChatScreenStyles';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import { apiPost } from '../services/api';
import {
  createConversation,
  getConversationTitle,
  loadConversations,
  saveConversations,
} from '../services/chatStorage';
import { colors } from '../theme/colors';

const suggestions = [
  'Hi! What can you help me with?',
  'Can I return a defective graphics card?',
  'How much is delivery to Chattogram?',
];

export function ChatScreen() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [historyVisible, setHistoryVisible] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const listRef = useRef(null);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const messageSequenceRef = useRef(0);
  const activeConversation = conversations.find(({ id }) => id === activeId);
  const messages = activeConversation?.messages || [];

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    loadConversations()
      .then((saved) => {
        if (!active) return;
        setConversations(saved);
        setActiveId(saved[0]?.id || null);
      })
      .catch((reason) => {
        console.warn('Could not restore chat history:', reason);
      })
      .finally(() => {
        if (active) setStorageReady(true);
      });
    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    saveConversations(conversations).catch((reason) =>
      console.warn('Could not save chat history:', reason),
    );
  }, [conversations, storageReady]);

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

  const ask = async (value = draft) => {
    const question = value.trim();
    if (!question || busyRef.current || !storageReady) return;
    busyRef.current = true;
    const existing = activeConversation;
    const conversation = existing || createConversation();
    const history = conversation.messages
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));
    const userMessage = {
      id: `message-${Date.now()}-${++messageSequenceRef.current}`,
      role: 'user',
      content: question,
      sources: [],
    };
    const updatedConversation = {
      ...conversation,
      title: conversation.messages.length
        ? conversation.title
        : getConversationTitle(question),
      updatedAt: new Date().toISOString(),
      messages: [...conversation.messages, userMessage],
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
    const timeout = setTimeout(() => controller.abort(), 50000);
    try {
      const result = await apiPost(
        '/chat',
        { question, history },
        { signal: controller.signal },
      );
      if (mountedRef.current) {
        const assistantMessage = {
          id: `message-${Date.now()}-${++messageSequenceRef.current}`,
          role: 'assistant',
          content: result.answer,
          sources: result.sources || [],
        };
        updateConversation(conversation.id, (current) => ({
          ...current,
          updatedAt: new Date().toISOString(),
          messages: [...current.messages, assistantMessage],
        }));
      }
    } catch (reason) {
      if (mountedRef.current) {
        setError(
          reason.name === 'AbortError'
            ? 'The response took too long. Please try again.'
            : reason.message,
        );
      }
    } finally {
      clearTimeout(timeout);
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
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
        <Text
          selectable
          style={[
            styles.messageText,
            item.role === 'user' ? styles.userText : styles.assistantText,
          ]}
        >
          {item.content}
        </Text>
        {item.sources?.length ? (
          <View style={styles.sources}>
            {item.sources.map((source) => (
              <Text
                key={source.chunkId || `${source.docId}-${source.sectionNumber}-${source.pageNumber}`}
                style={styles.sourceText}
              >
                {source.docTitle}, section {source.sectionNumber}
                {source.pageNumber ? ` · p. ${source.pageNumber}` : ''}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.iconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.blue} />
            </View>
            <Text style={styles.cardTitle}>Ask me anything</Text>
            <Text style={styles.cardText}>
              I can chat normally and answer Gentech policy questions from the
              published PDFs. Live order, stock and account details aren’t available.
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
        {busy ? (
          <View style={styles.typing}>
            <ActivityIndicator size="small" color={colors.blue} />
            <Text style={styles.typingText}>Thinking…</Text>
          </View>
        ) : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message Gentech…"
            placeholderTextColor={colors.muted}
            style={styles.input}
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
                <Pressable
                  onPress={() => {
                    setActiveId(item.id);
                    setHistoryVisible(false);
                    setError('');
                  }}
                  style={[
                    styles.historyItem,
                    item.id === activeId && styles.historyItemActive,
                  ]}
                >
                  <Ionicons name="chatbubble-outline" size={17} color={colors.muted} />
                  <Text numberOfLines={1} style={styles.historyItemText}>{item.title}</Text>
                  {item.id === activeId ? (
                    <Ionicons name="checkmark" size={18} color={colors.blue} />
                  ) : null}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
