// Decompile Buffer Creation (D3D11_BUFFER_DESC)
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;

import java.io.File;
import java.io.PrintWriter;

public class DecompileBufferCreate extends GhidraScript {
    @Override
    public void run() throws Exception {
        DecompInterface ifc = new DecompInterface();
        ifc.openProgram(currentProgram);

        String[] targets = {"140a18c70", "140a16e20"};
        try (PrintWriter pw = new PrintWriter(new File("docs/buffer-create-decomp.txt"))) {
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
