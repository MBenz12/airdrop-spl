import { PublicKey } from "@metaplex-foundation/js";
import { createAssociatedTokenAccountInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Transaction } from "@solana/web3.js";

import Users from '../users.json';
import { useState } from "react";

const mint = new PublicKey("7DVHQDqPppxjz2GNUz7kHLMiWewmuduNvNDKxx2giS1s");
const amount = 1;
const usersPerTx = 5;
const usersPerSign = 50 * usersPerTx;
export default function Home() {
    const wallet = useWallet();
    const { connection } = useConnection();
    const [txSignatures, setTxSignatures] = useState<Array<string>>(["7DVHQDqPppxjz2GNUz7kHLMiWewmuduNvNDKxx2giS1s"]);

    const airdrop = async (users: Array<string>) => {
        if (!wallet || !wallet.publicKey || !wallet.signAllTransactions) return;

        try {
            const owner = wallet.publicKey;
            const ownerAta = getAssociatedTokenAddressSync(mint, owner);
            const { value: { amount: totalAmount, decimals } } = await connection.getTokenAccountBalance(ownerAta);
            console.log(totalAmount);

            const txns: Array<Transaction> = [];
            let txn = new Transaction();
            let txnCnt = 0;
            for (const userAddress of users) {
                const user = new PublicKey(userAddress);
                const userAta = getAssociatedTokenAddressSync(mint, user);
                txn.add(
                    createAssociatedTokenAccountInstruction(
                        owner,
                        userAta,
                        user,
                        mint
                    )
                );
                txn.add(
                    createTransferCheckedInstruction(
                        ownerAta,
                        mint,
                        userAta,
                        owner,
                        amount,
                        decimals
                    )
                );
                txnCnt++;
                if (txnCnt % 5 === 0) {
                    txns.push(txn);
                    txn = new Transaction();
                }
            }

            if (txnCnt % 5 && txn.instructions.length) {
                txns.push(txn);
            }

            const recentBlockhash = (await connection.getLatestBlockhash('finalized')).blockhash;

            txns.forEach(tx => {
                tx.feePayer = owner;
                tx.recentBlockhash = recentBlockhash;
            });

            const signedTxns = await wallet.signAllTransactions(txns);
            
            const signatures = [];
            for (const signedTxn of signedTxns) {
                const txSignature = await connection.sendRawTransaction(signedTxn.serialize(), { skipPreflight: true });
                signatures.push(txSignature);
                txSignatures.push(txSignature);
                setTxSignatures(txSignatures);
            }
            for (const txSignature of signatures) {
                await connection.confirmTransaction(txSignature, "confirmed");
            }
        } catch (error) {
            console.log(error);
        }
    }

    const startAirdrop = async () => {
        for (let i = 0; i < Users.length / usersPerSign; i += usersPerSign) {
            await airdrop(Users.slice(i, i + usersPerSign));
        }
    }

    return (
        <div className="flex">
            <div className="flex flex-col gap-2">
                <WalletMultiButton></WalletMultiButton>
                <button className="border-2 rounded-2 font-[24px] p-2" onClick={startAirdrop}>Start Airdrop</button>
                <div className="mt-5">
                    {txSignatures.map((txSignature, index) => (
                        <div key={txSignature} >
                            {index + 1}. {txSignature}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};