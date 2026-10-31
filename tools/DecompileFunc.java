// Decompile FUN_140160fa0
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;

import java.io.File;
import java.io.PrintWriter;

public class DecompileFunc extends GhidraScript {
    @Override
    public void run() throws Exception {
        DecompInterface ifc = new DecompInterface();
        ifc.openProgram(currentProgram);

        String[] funcs = {"140160fa0", "140177720", "140177a40"};
        try (PrintWriter pw = new PrintWriter(new File("docs/func-decomp-raw.txt"))) {
            for (String fAddr : funcs) {
                Function f = getFunctionAt(toAddr(fAddr));
                if (f != null) {
                    pw.println("=== " + f.getName() + " @ " + f.getEntryPoint() + " ===");
                    DecompileResults res = ifc.decompileFunction(f, 60, monitor);
                    if (res != null && res.decompileCompleted() && res.getDecompiledFunction() != null) {
                        pw.println(res.getDecompiledFunction().getC());
                    }
                }
            }
        }
        ifc.dispose();
        println("Done!");
    }
}

