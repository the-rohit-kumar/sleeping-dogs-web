// Decompile core loader functions
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;

import java.io.File;
import java.io.PrintWriter;

public class DecompileCoreLoaders extends GhidraScript {
    @Override
    public void run() throws Exception {
        DecompInterface ifc = new DecompInterface();
        ifc.openProgram(currentProgram);

        String[] targets = {
            "140a18e90", // Texture load single / mips
            "140a16ed0", // Texture load subresource
            "140a19cc0", // BufferLoader method 0
            "140a1f2e0"  // BufferLoader method 1
        };
        try (PrintWriter pw = new PrintWriter(new File("docs/core-loaders-decomp.txt"))) {
            for (String t : targets) {
                Function f = getFunctionAt(toAddr(t));
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

