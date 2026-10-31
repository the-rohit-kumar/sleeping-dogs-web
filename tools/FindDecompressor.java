// Find where decompression actually occurs
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceIterator;

public class FindDecompressor extends GhidraScript {
    @Override
    public void run() throws Exception {
        println("=== Searching for Decompression Dispatch ===");
        DecompInterface ifc = new DecompInterface();
        ifc.openProgram(currentProgram);

        Address errStr = toAddr("1416abcd0"); // s_ERROR_DECOMPRESSION
        ReferenceIterator refs = currentProgram.getReferenceManager().getReferencesTo(errStr);
        while (refs.hasNext()) {
            Reference r = refs.next();
            Address from = r.getFromAddress();
            Function f = getFunctionContaining(from);
            if (f != null) {
                println("Found in function: " + f.getName() + " @ " + f.getEntryPoint());
                DecompileResults res = ifc.decompileFunction(f, 30, monitor);
                if (res != null && res.decompileCompleted() && res.getDecompiledFunction() != null) {
                    println(res.getDecompiledFunction().getC());
                }
            }
        }
        ifc.dispose();
    }
}

