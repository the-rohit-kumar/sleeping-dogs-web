// Inspect Illusion Loaders and Inventories
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

public class InspectLoaders extends GhidraScript {
    @Override
    public void run() throws Exception {
        println("=== Inspecting Illusion Loaders and Inventories ===");
        DecompInterface ifc = new DecompInterface();
        ifc.openProgram(currentProgram);

        String[][] targets = {
            {"TextureLoader", "1420f2d30"},
            {"BufferLoader", "1420f2c18"},
            {"ModelDataInventory", "142031b00"},
            {"rTexture", "1420317f8"},
            {"rMaterial", "1420214d8"}
        };

        File outFile = new File("docs/loaders-decomp-raw.txt");
        try (PrintWriter pw = new PrintWriter(outFile)) {
            for (String[] t : targets) {
                String name = t[0];
                Address addr = toAddr(t[1]);
                pw.println("\n==========================================");
                pw.println("Class: " + name + " @ " + addr);
                pw.println("==========================================");
                println("Checking " + name + " @ " + addr);

                ReferenceIterator refs = currentProgram.getReferenceManager().getReferencesTo(addr);
                Set<Function> funcs = new HashSet<>();
                while (refs.hasNext()) {
                    Reference r = refs.next();
                    Address from = r.getFromAddress();
                    pw.println("  Reference from: " + from);
                    
                    // Look around 'from' for vtables and references
                    ReferenceIterator colRefs = currentProgram.getReferenceManager().getReferencesTo(from.subtract(12));
                    while (colRefs.hasNext()) {
                        Reference vr = colRefs.next();
                        Address vtable = vr.getFromAddress().add(8);
                        pw.println("    VTABLE at: " + vtable);
                        for (int i = 0; i < 12; i++) {
                            Address slot = vtable.add(i * 8);
                            long codeAddr = getLong(slot);
                            Function f = getFunctionAt(toAddr(codeAddr));
                            if (f != null) {
                                funcs.add(f);
                                pw.println("      vfunc[" + i + "]: " + f.getName() + " @ " + f.getEntryPoint());
                            }
                        }
                    }
                    Function directF = getFunctionContaining(from);
                    if (directF != null) {
                        funcs.add(directF);
                    }
                }

                pw.println("Decompiling " + funcs.size() + " functions for " + name);
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
}

