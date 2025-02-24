import { collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";
import { firestore } from "../firebaseConfig";

export interface ProposalFirestore {
  id?: string;
  proposalId: number;
  description: string;
  deadline: number;
  likes: number;
  createdAt: number;
}

export async function addProposalToFirestore(proposal: ProposalFirestore): Promise<void> {
  try {
    const proposalsCol = collection(firestore, "proposals");
    await addDoc(proposalsCol, {
      ...proposal,
      createdAt: Date.now(),
    });
    console.log("Предложение сохранено в Firestore");
  } catch (error) {
    console.error("Ошибка при сохранении предложения в Firestore:", error);
  }
}

export async function getProposalsFromFirestore(): Promise<ProposalFirestore[]> {
  try {
    const proposalsCol = collection(firestore, "proposals");
    const q = query(proposalsCol, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const proposals: ProposalFirestore[] = [];
    snapshot.forEach((doc) => {
      proposals.push({
        id: doc.id,
        ...(doc.data() as ProposalFirestore),
      });
    });
    return proposals;
  } catch (error) {
    console.error("Ошибка при получении предложений из Firestore:", error);
    return [];
  }
}
