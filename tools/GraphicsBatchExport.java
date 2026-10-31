// Ghidra Headless Java Script: GraphicsBatchExport.java
// Automates extraction of graphics initialization, COM calls, display configuration, and decompiler pseudocode.

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.InstructionIterator;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceIterator;
import ghidra.program.model.symbol.Symbol;
import ghidra.program.model.symbol.SymbolIterator;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.util.*;

public class GraphicsBatchExport extends GhidraScript {

    private static final String[][] TARGET_FUNCTIONS = {
        {"DXGI factory + adapter discovery", "14069f240"},
        {"Adapter selection", "1406a1e80"},
        {"Display configuration", "1406a2050"},
        {"D3D11 device initialization", "14069f9e0"},
        {"Display configuration helper", "14069ed80"},
        {"Display apply/update helper", "14069e790"},
        {"Graphics initialization helper A", "1406a0dd0"},
        {"Graphics initialization helper B", "140e9aa80"},
        {"Graphics initialization helper C", "140e9b930"},
        {"NVIDIA stereo capability helper", "140e9e7d0"},
        {"Second adapter writer", "1406a1efb"}
    };

    private static final String[][] TARGET_GLOBALS = {
        {"Selected DXGI adapter", "142439af8"},
        {"Selected DXGI output", "142439b00"},
        {"Selected output index", "142439adc"},
        {"DXGI factory", "142439af0"},
        {"D3D11 device", "142439ae0"},
        {"D3D11 immediate context", "142439ae8"},
        {"Queried device interface", "142439b08"},
        {"Display settings update flag", "142439a93"},
        {"Display aspect ratio", "14209344c"},
        {"Display settings pointer", "142439b20"},
        {"Adapter record array", "14243a3a8"},
        {"Adapter record count", "14243a3a0"},
        {"Output record array", "142439bf0"},
        {"Output record count", "142439be8"}
    };

    private static final String[] API_NAME_PARTS = {
        "D3D11CreateDevice", "CreateDXGIFactory", "CreateSwapChain",
        "Present", "ResizeBuffers", "GetBuffer", "GetDesc",
        "CreateRenderTargetView", "CreateDepthStencilView", "CreateTexture2D",
        "CreateBuffer", "CreateQuery", "CheckFormatSupport",
        "CheckMultisampleQualityLevels", "SetFullscreenState",
        "GetDisplayModeList", "EnumAdapters", "EnumOutputs",
        "DrawIndexed", "Draw"
    };

    private static final int MAX_DECOMPILED = 60;
    private static final int TIMEOUT_SECS = 30;

    @Override
    public void run() throws Exception {
        File outDir = new File("c:/Users/rohit/Downloads/ANTIGRAVITY_HANDOFF_BUNDLE/antigravity_handoff_bundle/docs");
        outDir.mkdirs();
        File outFile = new File(outDir, "graphics-research-raw.txt");
        println("Exporting graphics batch report to: " + outFile.getAbsolutePath());

        StringBuilder sb = new StringBuilder();
        sb.append("================================================================================\n");
        sb.append("SLEEPING DOGS: DEFINITIVE EDITION - GRAPHICS BATCH DECOMPILATION REPORT\n");
        sb.append("Program: ").append(currentProgram.getName()).append("\n");
        sb.append("Image Base: ").append(currentProgram.getImageBase()).append("\n");
        sb.append("Generated headlessly via Ghidra 12.2 Java Script\n");
        sb.append("================================================================================\n\n");

        Map<String, Function> functionsToDecompile = new LinkedHashMap<>();
        List<Function> primaryFunctions = new ArrayList<>();

        // 1. Process target functions
        sb.append("--- [1. TARGET FUNCTIONS & REFERENCES] ---\n");
        for (String[] tf : TARGET_FUNCTIONS) {
            String label = tf[0];
            String addrStr = tf[1];
            Address addr = toAddr(addrStr);
            Function func = getFunctionAt(addr);
            if (func == null) {
                func = getFunctionContaining(addr);
            }
            sb.append("\nTarget: ").append(label).append(" (Address: ").append(addrStr).append(")\n");
            if (func == null) {
                sb.append("  Status: NOT FOUND as defined function\n");
                continue;
            }
            sb.append("  Resolved: ").append(func.getName()).append(" @ ").append(func.getEntryPoint()).append("\n");
            primaryFunctions.add(func);
            functionsToDecompile.put(func.getEntryPoint().toString(), func);

            // References TO target function
            ReferenceIterator refs = currentProgram.getReferenceManager().getReferencesTo(func.getEntryPoint());
            while (refs.hasNext()) {
                Reference r = refs.next();
                Address from = r.getFromAddress();
                Function caller = getFunctionContaining(from);
                String callerStr = caller != null ? caller.getName() + " @ " + caller.getEntryPoint() : "<no function>";
                sb.append("  XREF from: ").append(from).append(" [").append(r.getReferenceType()).append("] in ").append(callerStr).append("\n");
                if (caller != null) {
                    functionsToDecompile.put(caller.getEntryPoint().toString(), caller);
                }
            }

            // Direct calls FROM target function
            InstructionIterator instructions = currentProgram.getListing().getInstructions(func.getBody(), true);
            Set<String> callTargets = new TreeSet<>();
            while (instructions.hasNext()) {
                Instruction ins = instructions.next();
                Reference[] insRefs = currentProgram.getReferenceManager().getReferencesFrom(ins.getAddress());
                for (Reference ir : insRefs) {
                    if (ir.getReferenceType().isCall()) {
                        Address dest = ir.getToAddress();
                        Function callee = getFunctionAt(dest);
                        if (callee == null) callee = getFunctionContaining(dest);
                        if (callee != null) {
                            callTargets.add(callee.getName() + " @ " + callee.getEntryPoint());
                        } else {
                            Symbol sym = currentProgram.getSymbolTable().getPrimarySymbol(dest);
                            String symName = sym != null ? sym.getName() : "<unlabelled>";
                            callTargets.add(symName + " @ " + dest);
                        }
                    }
                }
            }
            for (String ct : callTargets) {
                sb.append("  CALLS: ").append(ct).append("\n");
            }
        }

        // 2. Global variable references
        sb.append("\n--- [2. TARGET GLOBALS & REFERENCES] ---\n");
        for (String[] tg : TARGET_GLOBALS) {
            String label = tg[0];
            String addrStr = tg[1];
            Address addr = toAddr(addrStr);
            sb.append("\nGlobal: ").append(label).append(" (").append(addrStr).append(")\n");
            ReferenceIterator refs = currentProgram.getReferenceManager().getReferencesTo(addr);
            int refCount = 0;
            while (refs.hasNext()) {
                Reference r = refs.next();
                refCount++;
                Address from = r.getFromAddress();
                Function caller = getFunctionContaining(from);
                String callerStr = caller != null ? caller.getName() + " @ " + caller.getEntryPoint() : "<no function>";
                sb.append("  Accessed from: ").append(from).append(" [").append(r.getReferenceType()).append("] in ").append(callerStr).append("\n");
                if (caller != null) {
                    functionsToDecompile.put(caller.getEntryPoint().toString(), caller);
                }
            }
            if (refCount == 0) {
                sb.append("  No references found.\n");
            }
        }

        // 3. Search for graphics API symbols
        sb.append("\n--- [3. MATCHED GRAPHICS API SYMBOLS] ---\n");
        SymbolIterator symIter = currentProgram.getSymbolTable().getAllSymbols(true);
        Set<Address> seenSymAddrs = new HashSet<>();
        while (symIter.hasNext()) {
            Symbol sym = symIter.next();
            String name = sym.getName();
            String upper = name.toUpperCase();
            for (String part : API_NAME_PARTS) {
                if (upper.contains(part.toUpperCase())) {
                    Address addr = sym.getAddress();
                    if (seenSymAddrs.add(addr)) {
                        sb.append("\nAPI Symbol: ").append(name).append(" @ ").append(addr).append("\n");
                        ReferenceIterator refs = currentProgram.getReferenceManager().getReferencesTo(addr);
                        while (refs.hasNext()) {
                            Reference r = refs.next();
                            Address from = r.getFromAddress();
                            Function caller = getFunctionContaining(from);
                            String callerStr = caller != null ? caller.getName() + " @ " + caller.getEntryPoint() : "<no function>";
                            sb.append("  XREF from: ").append(from).append(" in ").append(callerStr).append("\n");
                            if (caller != null) {
                                functionsToDecompile.put(caller.getEntryPoint().toString(), caller);
                            }
                        }
                    }
                    break;
                }
            }
        }

        // 4. Decompile ordered functions
        sb.append("\n================================================================================\n");
        sb.append("--- [4. DECOMPILATION OF IDENTIFIED FUNCTIONS] ---\n");
        sb.append("Total candidate functions collected: ").append(functionsToDecompile.size()).append("\n");

        List<Function> decompList = new ArrayList<>(primaryFunctions);
        for (Function f : functionsToDecompile.values()) {
            if (!decompList.contains(f)) {
                decompList.add(f);
            }
        }

        if (decompList.size() > MAX_DECOMPILED) {
            sb.append("Capping decompilation to first ").append(MAX_DECOMPILED).append(" functions.\n");
            decompList = decompList.subList(0, MAX_DECOMPILED);
        }

        DecompInterface ifc = new DecompInterface();
        ifc.openProgram(currentProgram);

        try {
            int idx = 0;
            for (Function f : decompList) {
                idx++;
                println("Decompiling (" + idx + "/" + decompList.size() + "): " + f.getName() + " @ " + f.getEntryPoint());
                sb.append("\n--------------------------------------------------------------------------------\n");
                sb.append("FUNCTION [").append(idx).append("/").append(decompList.size()).append("]: ");
                sb.append(f.getName()).append(" @ ").append(f.getEntryPoint()).append("\n");
                sb.append("Signature: ").append(f.getSignature()).append("\n");
                sb.append("Size (bytes): ").append(f.getBody().getNumAddresses()).append("\n");
                sb.append("--------------------------------------------------------------------------------\n");

                DecompileResults res = ifc.decompileFunction(f, TIMEOUT_SECS, monitor);
                if (res != null && res.decompileCompleted() && res.getDecompiledFunction() != null) {
                    sb.append(res.getDecompiledFunction().getC()).append("\n");
                } else {
                    sb.append("// Decompilation incomplete or timed out: ")
                      .append(res != null ? res.getErrorMessage() : "null result").append("\n");
                }
            }
        } finally {
            ifc.dispose();
        }

        try (BufferedWriter writer = new BufferedWriter(new FileWriter(outFile))) {
            writer.write(sb.toString());
        }

        println("SUCCESS: Exported " + decompList.size() + " functions to " + outFile.getAbsolutePath());
    }
}
