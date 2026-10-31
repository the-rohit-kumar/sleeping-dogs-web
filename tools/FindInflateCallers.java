// Find inflate function and its callers in sdhdship.exe
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceIterator;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.util.HashSet;
import java.util.Set;

public class FindInflateCallers extends GhidraScript {
    @Override
    public void run() throws Exception {
        println("=== Locating zlib inflate and callers ===");
        DecompInterface ifc = new DecompInterface();
        ifc.openProgram(currentProgram);

        // Target: "incorrect header check" or "invalid block type"
        Address[] zerrAddresses = {
            toAddr("141ac12a8"), // incorrect header check
            toAddr("141ac1330"), // invalid block type
            toAddr("141ac3588")  // incompatible version
        };

        Set<Function> inflateFuncs = new HashSet<>();
        for (Address addr : zerrAddresses) {
            ReferenceIterator refs = currentProgram.getReferenceManager().getReferencesTo(addr);
            while (refs.hasNext()) {
                Reference r = refs.next();
                Function f = getFunctionContaining(r.getFromAddress());
                if (f != null) {
                    inflateFuncs.add(f);
                }
            }
        }

        File outFile = new File("docs/inflate-callers-raw.txt");
        try (BufferedWriter bw = new BufferedWriter(new FileWriter(outFile))) {
            for (Function f : inflateFuncs) {
                String msg = "Inflate function: " + f.getName() + " @ " + f.getEntryPoint() + "\n";
                println(msg);
                bw.write(msg);

                // Find callers of this inflate function
                ReferenceIterator callers = currentProgram.getReferenceManager().getReferencesTo(f.getEntryPoint());
                Set<Function> callerFuncs = new HashSet<>();
                while (callers.hasNext()) {
                    Reference cr = callers.next();
                    Function cf = getFunctionContaining(cr.getFromAddress());
                    if (cf != null && !cf.equals(f)) {
                        callerFuncs.add(cf);
                    }
                }

                bw.write("Callers count: " + callerFuncs.size() + "\n");
                for (Function cf : callerFuncs) {
                    String callerMsg = "  Caller: " + cf.getName() + " @ " + cf.getEntryPoint() + "\n";
                    println(callerMsg);
                    bw.write(callerMsg);

                    DecompileResults res = ifc.decompileFunction(cf, 60, monitor);
                    if (res != null && res.decompileCompleted() && res.getDecompiledFunction() != null) {
                        bw.write("--- CALLER PSEUDOCODE START (" + cf.getName() + ") ---\n");
                        bw.write(res.getDecompiledFunction().getC());
                        bw.write("\n--- CALLER PSEUDOCODE END ---\n\n");
                    }
                }
            }
        }
        ifc.dispose();
        println("SUCCESS: Wrote inflate callers to " + outFile.getAbsolutePath());
    }
}
