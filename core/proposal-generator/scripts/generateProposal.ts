// Load environment variables
import { config } from "dotenv";
config();

const isValidObjectId = (id?: string) => /^[a-fA-F0-9]{24}$/.test(id ?? "");

const main = async () => {
  const [,, signalArg, userArg] = process.argv;

  let signalId = signalArg;
  const userId = userArg ?? process.env.USER_ID ?? "dev-user";

  if (signalId && !isValidObjectId(signalId)) {
    console.error("Invalid SIGNAL_ID: must be a 24-character hex ObjectId.");
    process.exit(1);
  }

if (!signalId) {
    const { fetchLatestSignal } = await import("../src/utils/db");
    let latest: any; // Dùng any tạm thời hoặc để TypeScript tự suy luận
    try {
      latest = await fetchLatestSignal();
    } catch (err: any) {
      console.error(
        "Unable to fetch latest signal: MongoDB connection failed.",
        err?.message ?? err,
      );
      console.error(
        `Check MONGODB_URI, network access (Atlas IP whitelist), and credentials.`
      );
      process.exit(1);
    }

    
    // Kiểm tra nếu latest là mảng thì lấy phần tử đầu tiên, nếu không thì giữ nguyên
    const signalDoc = Array.isArray(latest) ? latest[0] : latest;

    if (!signalDoc) {
      console.error("No signals found in DB; please provide a SIGNAL_ID.");
      process.exit(1);
    }
    
    // Lấy _id từ signalDoc đã được xử lý
    signalId = String(signalDoc._id);
    console.log("Using latest signal:", signalId);
  }

  const { initProposalGeneratorGraph } = await import("../src/index");
  const { graph, config } = await initProposalGeneratorGraph(signalId!, userId);

  const result = await graph.invoke({}, config);

  console.log(result.proposal);

  // If you want to persist the proposal, uncomment and implement repository
  // const proposalRepository = new PostgresProposalRepository();
  // if (result.proposal) {
  //   await proposalRepository.createProposal(result.proposal);
  // } else {
  //   console.error("Proposal was not generated");
  // }
};

main();
