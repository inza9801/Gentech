FILTER_CONFIG = {
    "processors": {
        "cores": {"type": "number", "field": "specs.cores"},
        "threads": {"type": "number", "field": "specs.threads"},
        "socket": {"type": "text", "field": "specs.socket"},
        "series": {"type": "text", "field": "specs.series"},
    },
    "motherboards": {
        "socket": {"type": "text", "field": "specs.socket"},
        "chipset": {"type": "text", "field": "specs.chipset"},
        "formFactor": {"type": "text", "field": "specs.formFactor"},
        "memoryType": {"type": "text", "field": "specs.memoryType"},
    },
    "rams": {
        "capacityGB": {"type": "number", "field": "specs.capacityGB"},
        "memoryType": {"type": "text", "field": "specs.memoryType"},
        "speedMHz": {"type": "number", "field": "specs.speedMHz"},
        "modules": {"type": "number", "field": "specs.modules"},
    },
    "graphics_cards": {
        "series": {"type": "text", "field": "specs.series"},
        "vramGB": {"type": "number", "field": "specs.vramGB"},
        "memoryType": {"type": "text", "field": "specs.memoryType"},
        "interface": {"type": "text", "field": "specs.interface"},
    },
    "ssds": {
        "capacityGB": {"type": "number", "field": "specs.capacityGB"},
        "interface": {"type": "text", "field": "specs.interface"},
        "formFactor": {"type": "text", "field": "specs.formFactor"},
    },
    "monitors": {
        "sizeInches": {"type": "number", "field": "specs.sizeInches"},
        "resolution": {"type": "text", "field": "specs.resolution"},
        "refreshRate": {"type": "number", "field": "specs.refreshRate"},
        "panelType": {"type": "text", "field": "specs.panelType"},
    },
    "power_supplies": {
        "wattage": {"type": "number", "field": "specs.wattage"},
        "efficiency": {"type": "text", "field": "specs.efficiency"},
        "modular": {"type": "text", "field": "specs.modular"},
    },
    "casings": {
        "formFactor": {"type": "text", "field": "specs.formFactor"},
        "motherboardSupport": {
            "type": "text",
            "field": "specs.motherboardSupport",
        },
    },
    "keyboards": {
        "keyboardType": {"type": "text", "field": "specs.keyboardType"},
        "switchType": {"type": "text", "field": "specs.switchType"},
        "connectivity": {"type": "text", "field": "specs.connectivity"},
    },
    "mice": {
        "sensorDPI": {"type": "number", "field": "specs.sensorDPI"},
        "connectivity": {"type": "text", "field": "specs.connectivity"},
        "mouseType": {"type": "text", "field": "specs.mouseType"},
    },
    "ups": {
        "capacityVA": {"type": "number", "field": "specs.capacityVA"},
        "backupMinutes": {"type": "number", "field": "specs.backupMinutes"},
    },
    "laptops": {
        "processor": {"type": "text", "field": "specs.processor"},
        "ramGB": {"type": "number", "field": "specs.ramGB"},
        "storageGB": {"type": "number", "field": "specs.storageGB"},
        "gpu": {"type": "text", "field": "specs.gpu"},
        "screenSize": {"type": "number", "field": "specs.screenSize"},
    },
}