// Decompile decompression functions referencing OP_READ_AND_DECOMPRESS and zlib
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

public class DecompileDecompress extends GhidraScript {
    @Override
    public void run() throws Exception {
        println("=== Decompiling Read and Decompress logic ===");
        DecompInterface ifc = new DecompInterface();
        ifc.openProgram(currentProgram);

        Address[] targets = {
            toAddr("1416a0f10"), // s_READ_AND_DECOMPRESS
            toAddr("1416aca98"), // s_qFileOp.OP_READ_AND_DECOMPRESS
            toAddr("1416ad5f8"), // s_[Resource_-_LoadChunkFile]_Error
            toAddr("141a482d0"), // s_StDecompress
            toAddr("141ac3781"), // s_deflate_1.2.7
            toAddr("1416abcd0")  // s_ERROR_DECOMPRESSION
        };

        File outFile = new File("docs/decompress-research-raw.txt");
        try (BufferedWriter bw = new BufferedWriter(new FileWriter(outFile))) {
            for (Address t : targets) {
                String header = "\n========================================\nTarget string @ " + t + "\n========================================\n";
                println(header);
                bw.write(header);
                ReferenceIterator refs = currentProgram.getReferenceManager().getReferencesTo(t);
                while (refs.hasNext()) {
                    Reference r = refs.next();
                    Address from = r.getFromAddress();
                    Function f = getFunctionContaining(from);
                    if (f != null) {
                        String fInfo = "Referenced in: " + f.getName() + " @ " + f.getEntryPoint() + "\n";
                        println(fInfo);
                        bw.write(fInfo);
                        DecompileResults res = ifc.decompileFunction(f, 60, monitor);
                        if (res != null && res.decompileCompleted() && res.getDecompiledFunction() != null) {
                            bw.write("--- PSEUDOCODE START (" + f.getName() + ") ---\n");
                            bw.write(res.getDecompiledFunction().getC());
                            bw.write("\n--- PSEUDOCODE END ---\n\n");
                        }
                    }
                }
            }
        }
        ifc.dispose();
        println("SUCCESS: Wrote decompress research to " + outFile.getAbsolutePath());
    }
}
