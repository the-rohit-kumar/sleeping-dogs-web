// Locate Illusion::TextureLoader and Illusion::BufferLoader in Ghidra
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceIterator;

import java.io.File;
import java.io.PrintWriter;
import java.util.HashSet;
import java.util.Set;

public class FindLoaders extends GhidraScript {
    @Override
    public void run() throws Exception {
        println("=== Locating TextureLoader and BufferLoader ===");
        DecompInterface ifc = new DecompInterface();
        ifc.openProgram(currentProgram);

        // Find string ".?AVTextureLoader@Illusion@@" and ".?AVBufferLoader@Illusion@@"
        Address[] rttiTargets = {
            findString(".?AVTextureLoader@Illusion@@"),
            findString(".?AVBufferLoader@Illusion@@"),
            findString(".?AVModelDataInventory@Illusion@@"),
            findString(".?AVrTexture@Illusion@@"),
            findString(".?AVrMaterial@Illusion@@")
        };

        File outFile = new File("docs/loaders-decomp-raw.txt");
        try (PrintWriter pw = new PrintWriter(outFile)) {
            for (Address target : rttiTargets) {
                if (target == null) continue;
                pw.println("\n==========================================");
                pw.println("RTTI Descriptor @ " + target);
                pw.println("==========================================");
                
                // Find references to RTTI descriptor (Complete Object Locator)
                ReferenceIterator refs = currentProgram.getReferenceManager().getReferencesTo(target);
                Set<Function> funcs = new HashSet<>();
                while (refs.hasNext()) {
                    Reference r = refs.next();
                    Address colAddr = r.getFromAddress();
                    // References to Complete Object Locator point to vtables
                    ReferenceIterator colRefs = currentProgram.getReferenceManager().getReferencesTo(colAddr.subtract(12));
                    while (colRefs.hasNext()) {
                        Reference vr = colRefs.next();
                        Address vtableAddr = vr.getFromAddress().add(8);
                        pw.println("Found vtable near: " + vtableAddr);
                        // Read first 10 virtual function pointers from vtable
                        for (int i = 0; i < 10; i++) {
                            Address ptrAddr = vtableAddr.add(i * 8);
                            Address funcAddr = toAddr(getLong(ptrAddr));
                            Function f = getFunctionAt(funcAddr);
                            if (f != null) {
                                funcs.add(f);
                                pw.println("  Method [" + i + "]: " + f.getName() + " @ " + funcAddr);
                            }
                        }
                    }
                }

                // Decompile methods
                for (Function f : funcs) {
                    pw.println("\n--- PSEUDOCODE START (" + f.getName() + " @ " + f.getEntryPoint() + ") ---");
                    DecompileResults res = ifc.decompileFunction(f, 60, monitor);
                    if (res != null && res.decompileCompleted() && res.getDecompiledFunction() != null) {
                        pw.println(res.getDecompiledFunction().getC());
                    }
                    pw.println("--- PSEUDOCODE END ---");
                }
            }
        }
        ifc.dispose();
        println("SUCCESS: Wrote loader research to " + outFile.getAbsolutePath());
    }

    private Address findString(String str) {
        ghidra.program.model.mem.Memory mem = currentProgram.getMemory();
        byte[] bytes = str.getBytes();
        Address addr = mem.getMinAddress();
        return findBytes(addr, bytes);
    }
}

