def _text(field: str, label: str) -> dict:
    return {"type": "text", "field": field, "label": label}


def _number(field: str, label: str) -> dict:
    return {"type": "number", "field": field, "label": label}


_COLOR = _text("color", "Color")
_WARRANTY = _text("warranty", "Warranty")

FILTER_CONFIG = {
    "casings": {
        "type": _text("type", "Case type"),
        "sidePanel": _text("sidePanel", "Side panel"),
        "formFactor": _text("formFactor", "Motherboard form factor"),
        "powerSupply": _text("powerSupply", "Included power supply"),
        "color": _COLOR,
        "warranty": _WARRANTY,
    },
    "graphics_cards": {
        "graphicsChipset": _text("graphicsChipset", "Graphics chipset"),
        "gpuSeries": _text("gpuSeries", "GPU series"),
        "memorySize": _text("memorySize", "Video memory"),
        "memoryType": _text("memoryType", "Memory type"),
        "gpuMaxResolution": _text("gpuMaxResolution", "Maximum resolution"),
        "color": _COLOR,
        "warranty": _WARRANTY,
    },
    "keyboards": {
        "keyboardType": _text("keyboardType", "Keyboard type"),
        "keyboardSwitch": _text("keyboardSwitch", "Switch type"),
        "connectionType": _text("connectionType", "Connectivity"),
        "size": _text("size", "Keyboard size"),
        "color": _COLOR,
        "warranty": _WARRANTY,
    },
    "laptops": {
        "laptopType": _text("laptopType", "Laptop type"),
        "processorType": _text("processorType", "Processor family"),
        "processorModel": _text("processorModel", "Processor model"),
        "generation": _text("generation", "Processor generation"),
        "ramSize": _text("ramSize", "Memory size"),
        "ramType": _text("ramType", "Memory type"),
        "ssd": _text("ssd", "Storage"),
        "graphics": _text("graphics", "Graphics"),
        "displaySize": _text("displaySize", "Display size"),
        "color": _COLOR,
        "warranty": _WARRANTY,
    },
    "mice": {
        "interface": _text("interface", "Connectivity"),
        "lighting": _text("lighting", "Lighting"),
        "numberOfButtons": _number("numberOfButtons", "Number of buttons"),
        "resolution": _text("resolution", "Sensor resolution"),
        "color": _COLOR,
        "warranty": _WARRANTY,
    },
    "monitors": {
        "displaySize": _text("displaySize", "Display size"),
        "displayType": _text("displayType", "Panel type"),
        "refreshRate": _text("refreshRate", "Refresh rate"),
        "resolution": _text("resolution", "Resolution"),
        "color": _COLOR,
        "warranty": _WARRANTY,
    },
    "motherboards": {
        "processorBrand": _text("processorBrand", "Processor brand"),
        "processorType": _text("processorType", "Processor compatibility"),
        "chipset": _text("chipset", "Chipset"),
        "formFactor": _text("formFactor", "Form factor"),
        "ramType": _text("ramType", "Memory type"),
        "ramSlots": _number("ramSlots", "Memory slots"),
        "maximumMemory": _text("maximumMemory", "Maximum memory"),
        "color": _COLOR,
        "warranty": _WARRANTY,
    },
    "power_supplies": {
        "watts": _number("watts", "Power output (W)"),
        "efficiency": _text("efficiency", "Efficiency"),
        "modular": _text("modular", "Modular design"),
        "formFactor": _text("formFactor", "Form factor"),
        "color": _COLOR,
        "warranty": _WARRANTY,
    },
    "processors": {
        "processorModel": _text("processorModel", "Processor model"),
        "generation": _text("generation", "Generation"),
        "socket": _text("socket", "Socket"),
        "numberOfCores": _number("numberOfCores", "Cores"),
        "numberOfThreads": _number("numberOfThreads", "Threads"),
        "clockSpeed": _text("clockSpeed", "Clock speed"),
        "cacheMemory": _text("cacheMemory", "Cache"),
        "color": _COLOR,
        "warranty": _WARRANTY,
    },
    "rams": {
        "ramSize": _text("ramSize", "Memory size"),
        "ramType": _text("ramType", "Memory type"),
        "ramSpeed": _text("ramSpeed", "Memory speed"),
        "color": _COLOR,
        "warranty": _WARRANTY,
    },
    "ssds": {
        "ssdSize": _text("ssdSize", "Storage capacity"),
        "formFactor": _text("formFactor", "Form factor"),
        "generation": _text("generation", "Interface generation"),
        "interface": _text("interface", "Interface"),
        "readSpeed": _text("readSpeed", "Read speed"),
        "writeSpeed": _text("writeSpeed", "Write speed"),
        "color": _COLOR,
        "warranty": _WARRANTY,
    },
    "ups": {
        "voltAmpere": _number("voltAmpere", "Capacity (VA)"),
        "loadCapacity": _number("loadCapacity", "Load capacity (W)"),
        "outputCapacity": _text("outputCapacity", "Output capacity"),
        "bodyMaterial": _text("bodyMaterial", "Body material"),
        "color": _COLOR,
        "warranty": _WARRANTY,
    },
}

for category_filters in FILTER_CONFIG.values():
    category_filters["brand"] = _text("brand", "Brand")
    category_filters["discount"] = _number("discount", "Discount (%)")
