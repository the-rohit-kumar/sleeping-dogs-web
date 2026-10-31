# @runtime PyGhidra
#@category SleepingDogs
# Read-only batch export for Sleeping Dogs: Definitive Edition graphics reverse engineering.
# Run from Ghidra 12.2 launched with support\pyghidraRun.bat.
# Does not modify the program database or the executable.

from ghidra.app.decompiler import DecompInterface
from ghidra.util.task import ConsoleTaskMonitor
from java.io import BufferedWriter, FileWriter
from java.lang import String

PROGRAM = currentProgram
MONITOR = getMonitor()

# Graphics functions already identified during the investigation.
TARGET_FUNCTIONS = [
    ("DXGI factory + adapter discovery", "14069f240"),
    ("Adapter selection", "1406a1e80"),
    ("Display configuration", "1406a2050"),
    ("D3D11 device initialization", "14069f9e0"),
    ("Display configuration helper", "14069ed80"),
    ("Display apply/update helper", "14069e790"),
    ("Graphics initialization helper A", "1406a0dd0"),
    ("Graphics initialization helper B", "140e9aa80"),
    ("Graphics initialization helper C", "140e9b930"),
    ("NVIDIA stereo capability helper", "140e9e7d0"),
]

# Globals relevant to adapter selection, device creation, and display state.
TARGET_GLOBALS = [
    ("Selected DXGI adapter", "142439af8"),
    ("Selected DXGI output", "142439b00"),
    ("Selected output index", "142439adc"),
    ("DXGI factory", "142439af0"),
    ("D3D11 device", "142439ae0"),
    ("D3D11 immediate context", "142439ae8"),
    ("Queried device interface", "142439b08"),
    ("Display settings update flag", "142439a93"),
    ("Display aspect ratio", "14209344c"),
    ("Display settings pointer", "142439b20"),
    ("Adapter record array", "14243a3a8"),
    ("Adapter record count", "14243a3a0"),
    ("Output record array", "142439bf0"),
    ("Output record count", "142439be8"),
]

# Imported/API symbols and COM-method-like names worth locating.
API_NAME_PARTS = [
    "D3D11CreateDevice", "CreateDXGIFactory", "CreateSwapChain",
    "Present", "ResizeBuffers", "GetBuffer", "GetDesc",
    "CreateRenderTargetView", "CreateDepthStencilView", "CreateTexture2D",
    "CreateBuffer", "CreateQuery", "CheckFormatSupport",
    "CheckMultisampleQualityLevels", "SetFullscreenState",
    "GetDisplayModeList", "EnumAdapters", "EnumOutputs",
]

MAX_DECOMPILED_FUNCTIONS = 50
DECOMP_TIMEOUT_SECONDS = 30


def line(report, value=""):
    report.append(str(value))


def get_function_at_or_containing(address_text):
    try:
        addr = toAddr(address_text)
        func = getFunctionAt(addr)
        if func is None:
            func = getFunctionContaining(addr)
        return func
    except:
        return None


def function_key(func):
    return str(func.getEntryPoint())


def function_label(func):
    return "%s @ %s" % (func.getName(), func.getEntryPoint())


def collect_references_to(address_text):
    result = []
    try:
        addr = toAddr(address_text)
        it = currentProgram.getReferenceManager().getReferencesTo(addr)
        while it.hasNext():
            ref = it.next()
            src = ref.getFromAddress()
            caller = getFunctionContaining(src)
            rtype = str(ref.getReferenceType())
            caller_text = function_label(caller) if caller is not None else "<no containing function>"
            result.append((src, rtype, caller, caller_text))
    except Exception as exc:
        result.append(("<error>", str(exc), None, ""))
    return result


def direct_call_targets(func):
    found = {}
    try:
        listing = currentProgram.getListing()
        instructions = listing.getInstructions(func.getBody(), True)
        while instructions.hasNext():
            ins = instructions.next()
            refs = currentProgram.getReferenceManager().getReferencesFrom(ins.getAddress())
            for ref in refs:
                if ref.getReferenceType().isCall():
                    dest = ref.getToAddress()
                    callee = getFunctionAt(dest)
                    if callee is None:
                        callee = getFunctionContaining(dest)
                    if callee is not None:
                        found[function_key(callee)] = function_label(callee)
                    else:
                        sym = currentProgram.getSymbolTable().getPrimarySymbol(dest)
                        name = sym.getName() if sym is not None else "<unlabelled>"
                        found[str(dest)] = "%s @ %s" % (name, dest)
    except Exception as exc:
        found["ERROR"] = str(exc)
    return sorted(found.values())


def decompile_function(ifc, func):
    try:
        result = ifc.decompileFunction(func, DECOMP_TIMEOUT_SECONDS, MONITOR)
        if result is None:
            return "<decompiler returned no result>"
        if not result.decompileCompleted():
            return "<decompilation incomplete: %s>" % result.getErrorMessage()
        dec = result.getDecompiledFunction()
        if dec is None:
            return "<no decompiled function returned>"
        return dec.getC()
    except Exception as exc:
        return "<decompilation exception: %s>" % exc


def add_function(func_map, func):
    if func is not None:
        func_map[function_key(func)] = func


report = []
line(report, "SLEEPING DOGS: DE FINAL EDITION - GRAPHICS BATCH EXPORT")
line(report, "Program: %s" % PROGRAM.getName())
line(report, "Image base: %s" % PROGRAM.getImageBase())
line(report, "Exported by a read-only Ghidra script. No program data was changed.")
line(report, "=" * 100)

# Resolve primary functions and collect their direct callers and callees.
functions_to_decompile = {}
primary_functions = []
for label_text, address_text in TARGET_FUNCTIONS:
    func = get_function_at_or_containing(address_text)
    line(report, "\n[TARGET FUNCTION] %s | requested address %s" % (label_text, address_text))
    if func is None:
        line(report, "NOT FOUND as a defined function")
        continue
    line(report, "Resolved: %s" % function_label(func))
    add_function(functions_to_decompile, func)
    primary_functions.append(func)
    for ref_info in collect_references_to(address_text):
        src, rtype, caller, caller_text = ref_info
        line(report, "  XREF from %s | type=%s | %s" % (src, rtype, caller_text))
        add_function(functions_to_decompile, caller)
    for callee_text in direct_call_targets(func):
        line(report, "  CALLS: %s" % callee_text)

# Collect all read/write references to globals and the functions containing them.
for label_text, address_text in TARGET_GLOBALS:
    line(report, "\n[GLOBAL REFERENCES] %s | %s" % (label_text, address_text))
    refs = collect_references_to(address_text)
    if not refs:
        line(report, "  No references found")
    for src, rtype, caller, caller_text in refs:
        line(report, "  %s | type=%s | %s" % (src, rtype, caller_text))
        add_function(functions_to_decompile, caller)

# Locate relevant imported/API symbols and their callsites.
line(report, "\n" + "=" * 100)
line(report, "[GRAPHICS API SYMBOLS AND CALLERS]")
symbols = currentProgram.getSymbolTable().getAllSymbols(True)
matched_symbols = []
while symbols.hasNext():
    sym = symbols.next()
    name = sym.getName()
    upper = name.upper()
    if any(part.upper() in upper for part in API_NAME_PARTS):
        matched_symbols.append(sym)

seen_symbol_addresses = set()
for sym in matched_symbols:
    addr_text = str(sym.getAddress())
    if addr_text in seen_symbol_addresses:
        continue
    seen_symbol_addresses.add(addr_text)
    line(report, "\nAPI/SYMBOL: %s @ %s" % (sym.getName(), addr_text))
    for src, rtype, caller, caller_text in collect_references_to(addr_text):
        line(report, "  XREF from %s | type=%s | %s" % (src, rtype, caller_text))
        add_function(functions_to_decompile, caller)

# Decompile selected functions and relevant callers, with a hard cap.
line(report, "\n" + "=" * 100)
line(report, "[DECOMPILATION OUTPUT]")
ifc = DecompInterface()
ifc.openProgram(PROGRAM)
# Put explicitly requested functions first, then callers discovered through xrefs.
ordered = []
seen_functions = set()
for func in primary_functions:
    key = function_key(func)
    if key not in seen_functions:
        ordered.append(func)
        seen_functions.add(key)
for func in sorted(functions_to_decompile.values(), key=lambda f: str(f.getEntryPoint())):
    key = function_key(func)
    if key not in seen_functions:
        ordered.append(func)
        seen_functions.add(key)
all_funcs = ordered
if len(all_funcs) > MAX_DECOMPILED_FUNCTIONS:
    line(report, "Function set capped at %d of %d candidates." % (MAX_DECOMPILED_FUNCTIONS, len(all_funcs)))
    all_funcs = all_funcs[:MAX_DECOMPILED_FUNCTIONS]

for idx, func in enumerate(all_funcs):
    MONITOR.checkCanceled()
    line(report, "\n" + "#" * 100)
    line(report, "FUNCTION %d/%d: %s" % (idx + 1, len(all_funcs), function_label(func)))
    line(report, "Signature: %s" % func.getSignature())
    line(report, "Body bytes: %d" % func.getBody().getNumAddresses())
    line(report, "Direct call targets:")
    for callee_text in direct_call_targets(func):
        line(report, "  " + callee_text)
    line(report, "\nPSEUDOCODE:\n")
    line(report, decompile_function(ifc, func))

ifc.dispose()

# Save the single consolidated report.
out_file = askFile("Save Sleeping Dogs graphics batch report", "Save")
writer = BufferedWriter(FileWriter(out_file))
try:
    for entry in report:
        writer.write(String(str(entry)))
        writer.newLine()
finally:
    writer.close()

popup("Graphics batch export complete.\nFunctions decompiled: %d\nReport: %s" % (len(all_funcs), out_file.getAbsolutePath()))
