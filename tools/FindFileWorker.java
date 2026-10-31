// Find the worker function processing qFileOp requests
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceIterator;

public class FindFileWorker extends GhidraScript {
    @Override
    public void run() throws Exception {
        println("=== Searching for File Op Worker ===");
        DecompInterface ifc = new DecompInterface();
        ifc.openProgram(currentProgram);

        // Find functions near FUN_140172500 in the same compilation unit (0x14016... to 0x14017...)
        Address[] addrs = {
            toAddr("140170a00"),
            toAddr("140171000"),
            toAddr("140172000"),
            toAddr("140173000")
        };

        for (Address a : addrs) {
            Function f = getFunctionContaining(a);
            if (f != null) {
                println("Checking func: " + f.getName() + " @ " + f.getEntryPoint());
            }
        }

        // Search for string "OP_READ_AND_DECOMPRESS" xrefs
        Address opStr = toAddr("1416aca98");
        ReferenceIterator refs = currentProgram.getReferenceManager().getReferencesTo(opStr);
        while (refs.hasNext()) {
            Reference r = refs.next();
            Function caller = getFunctionContaining(r.getFromAddress());
            if (caller != null) {
                println("Op string referenced in: " + caller.getName() + " @ " + caller.getEntryPoint());
                DecompileResults res = ifc.decompileFunction(caller, 30, monitor);
                if (res != null && res.decompileCompleted() && res.getDecompiledFunction() != null) {
                    println(res.getDecompiledFunction().getC());
                }
            }
        }
        ifc.dispose();
    }
}

