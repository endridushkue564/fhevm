import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { toBufferBE } from 'bigint-buffer';
import { ContractMethodArgs, Typed } from 'ethers';
import { Signer } from 'ethers';
import hre, { ethers, network } from 'hardhat';

import type { Counter } from '../types';
import { TypedContractMethod } from '../types/common';
import { getSigners } from './signers';

export async function checkIsHardhatSigner(signer: HardhatEthersSigner) {
  const signers = await hre.ethers.getSigners();
  if (!signers.some((s) => s.address === signer.address)) {
    throw new Error(
      `The provided address (${signer.address}) is not the address of a valid hardhat signer.
Please use addresses listed via the 'npx hardhat get-accounts --network hardhat' command.`,
    );
  }
}

export const waitForBlock = (blockNumber: bigint | number) =>
  network.name === 'hardhat'
    ? new Promise<number>((resolve, reject) => {
        const intervalId = setInterval(async () => {
          try {
            const currentBlock = await ethers.provider.getBlockNumber();
            if (BigInt(currentBlock) >= BigInt(blockNumber)) {
              clearInterval(intervalId);
              resolve(currentBlock);
            }
          } catch (error) {
            clearInterval(intervalId);
            reject(error);
          }
        }, 50);
      })
    : new Promise<number>((resolve, reject) => {
        const waitBlock = async (currentBlock: number) => {
          if (BigInt(currentBlock) >= BigInt(blockNumber)) {
            ethers.provider.off('block', waitBlock).catch(() => {});
            resolve(Number(blockNumber));
          }
        };
        ethers.provider.on('block', waitBlock).catch(reject);
      });

export const waitNBlocks = async (Nblocks: number): Promise<void> => {
  const currentBlock = await ethers.provider.getBlockNumber();
  if (network.name === 'hardhat') await produceDummyTransactions(Nblocks);
  await waitForBlock(BigInt(currentBlock + Nblocks));
};

export const waitForBalance = async (address: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const checkBalance = async () => {
      try {
        if ((await ethers.provider.getBalance(address)).gt(0)) {
          ethers.provider.off('block', checkBalance).catch(() => {});
          resolve();
        }
      } catch (err) { reject(err); }
    };
    ethers.provider.on('block', checkBalance).catch(reject);
  });

export const createTransaction = async <A extends [...{ [I in keyof A]-?: A[I] | Typed }]>(
  method: TypedContractMethod<A>,
  ...params: A
): Promise<any> => {
  const gasLimitBn = await method.estimateGas(...params);
  // Cap gas limit at max value
  const cappedGasLimit =
    Math.min(Math.round(+gasLimitBn.toString() * 1.2), 10_000_000);

  return method(...[...params, { gasLimit: cappedGasLimit }] as ContractMethodArgs<A>);
};

export const produceDummyTransactions = async (blockCount: number): Promise<void> => {
  let counterContractPromise: Promise<Counter>;
  
	// Lazy init contract deployment only once
	const deployOnce= (()=>{ 
		let cached :Promise<Counter>| null=null;
		return ()=>{
			if(!cached){
				cached=deployCounterContract()
			}
			return cached;
		}
	})();
	
	const contract=await deployOnce();

	for(let i=0;i<blockCount;i++){
  	const tx=await contract.increment();
  	await tx.wait();
	}
};

async function deployCounterContract(): Promise<Counter> {

	const signers=await getSigners();

	const factory=await ethers.getContractFactory('Counter');
	const deployed=factory.connect(signers.dave).deploy();
	await deployed.waitForDeployment();

	return deployed;
}

export const mineNBlocks = async(n:number)=>{
	for(let i=0;i<n;i++){
	  await ethers.provider.send('evm_mine');
	}
};

const bigIntToBytesX=(value:number)=>new Uint8Array(toBufferBE(value,bigValue=>bigValue));

export const bigIntToBytes64=(value:bigint)=>new Uint8Array(toBufferBE(value,64));
export const bigIntToBytes128=(value:bigint)=>new Uint8Array(toBufferBE(value,128));
export const bigIntToBytes256=(value:bigint)=>new Uint8Array(toBufferBE(value,256));

export interface UserDecryptParams{
	handle:string,
	contractAddress:string,
	instance:any,
	signer : Signer,
	privateKey:string,
	publicKey:string
}

export async function userDecryptSingleHandle({
	handle,
	contractAddress,
	instance,
	signer,
	privateKey,
	publicKey
}:UserDecryptParams):Promise<bigint>{
	
	const ctHandleContractPairs=[{ctHandle:handle , contractAddress}];
	
	const startTimeStamp=Math.floor(Date.now()/1000).toString(); 
	const durationDays='10'; 
	
	const eip712=instance.createEIP712(publicKey,[contractAddress],startTimeStamp,durationDays);

	const signature=await signer.signTypedData(
    	eip712.domain,{UserDecryptRequestVerification:eip712.types.UserDecryptRequestVerification},eip712.message);

  	return (
  		await instance.userDecrypt(
  			ctHandleContractPairs ,
  			privateKey ,
  			publicKey ,
  			signature.replace(/^0x/, '') ,
  			[contractAddress] ,
  			signer.address ,
  			startTimeStamp , 
				durationDays)
  	  );
}
