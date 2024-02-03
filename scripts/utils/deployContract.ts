import hardhat from "hardhat";
const { ethers } = hardhat;
import { Wallet } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import fs from "fs";

import { expectDeployed, isDeployed } from "./expectDeployed";
const BYTES32_0 = '0x0000000000000000000000000000000000000000000000000000000000000000'

export async function deployContract(deployer:Wallet|SignerWithAddress, contractName:string, args:any[]=[], overrides:any={}, confirmations:number=0) {
  const factory = await ethers.getContractFactory(contractName, deployer);
  const contract = await factory.deploy(...args, overrides);
  await contract.waitForDeployment();
  const tx = await contract.deploymentTransaction();
  await tx.wait(confirmations);
  contract.address = contract.target
  await expectDeployed(contract.address);
  return contract;
}
exports.deployContract = deployContract


export async function deployContractUsingContractFactory(deployer:Wallet|SignerWithAddress, contractName:string, args:any[]=[], salt:string=BYTES32_0, calldata:string|undefined=undefined, overrides:any={}, confirmations:number=0) {
  let factoryAbi = JSON.parse(fs.readFileSync("./data/abi/ContractFactory.json").toString());
  const FACTORY_ADDRESS = "0x2eF7f9C8545cB13EEaBc10CFFA3481553C70Ffc8";
  if(!(await isDeployed(FACTORY_ADDRESS))) throw new Error("Factory contract not detected");
  let factoryContract = await ethers.getContractAt(factoryAbi, FACTORY_ADDRESS, deployer);

  const contractFactory = await ethers.getContractFactory(contractName, deployer);
  const bytecode = contractFactory.getDeployTransaction(...args).data;
  const tx = await (!calldata
    ? factoryContract.deploy(bytecode, salt, overrides)
    : factoryContract.deployAndCall(bytecode, salt, calldata, overrides)
  );
  const receipt = await tx.wait(confirmations);
  if(!receipt.events || receipt.events.length == 0) {
    console.error("receipt")
    console.error(receipt)
    throw new Error("no events")
  }
  const event = receipt.events[receipt.events.length-1]
  if(!event.args || event.args.length == 0) {
    console.error("receipt")
    console.error(receipt)
    console.error(receipt.events)
    throw new Error("no args")
  }
  const contractAddress = event.args[0];
  await expectDeployed(contractAddress);
  const deployedContract = await ethers.getContractAt(contractName, contractAddress);
  return deployedContract;
}
exports.deployContract = deployContract


export async function verifyContract(address: string, constructorArguments: any) {
  console.log("Verifying contract");
  async function _sleeper(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  await _sleeper(30000); // likely just deployed a contract, let etherscan index it
  var verifyArgs: any = {
    address: address,
    constructorArguments: constructorArguments
  };
  try {
    await hardhat.run("verify:verify", verifyArgs);
    console.log("Verified")
  } catch(e) { /* probably already verified */ }
}
exports.verifyContract
