// Trace the qFileOp worker queue
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

public class FindWorkerThread extends GhidraScript {
    @Override
    public void run() throws Exception {
        println("=== Tracing qFileOp Worker Thread ===");
        DecompInterface ifc = new DecompInterface();
        ifc.openProgram(currentProgram);

        Address[] targets = {
            toAddr("14235ac80"), // Critical section
            toAddr("14235acc8")  // Queue head
        };

        Set<Function> workerFuncs = new HashSet<>();
        for (Address addr : targets) {
            ReferenceIterator refs = currentProgram.getReferenceManager().getReferencesTo(addr);
            while (refs.hasNext()) {
                Reference r = refs.next();
                Function f = getFunctionContaining(r.getFromAddress());
                if (f != null && !f.getEntryPoint().toString().equals("140189a10")) {
                    workerFuncs.add(f);
                }
            }
        }

        File outFile = new File("docs/worker-thread-raw.txt");
        try (BufferedWriter bw = new BufferedWriter(new FileWriter(outFile))) {
            bw.write("Found " + workerFuncs.size() + " worker functions\n");
            for (Function f : workerFuncs) {
                String msg = "Worker func: " + f.getName() + " @ " + f.getEntryPoint() + "\n";
                println(msg);
                bw.write(msg);

                DecompileResults res = ifc.decompileFunction(f, 60, monitor);
                if (res != null && res.decompileCompleted() && res.getDecompiledFunction() != null) {
                    bw.write("--- PSEUDOCODE START (" + f.getName() + ") ---\n");
                    bw.write(res.getDecompiledFunction().getC());
                    bw.write("\n--- PSEUDOCODE END ---\n\n");
                }
            }
        }
        ifc.dispose();
        println("SUCCESS: Wrote worker thread research to " + outFile.getAbsolutePath());
    }
}
