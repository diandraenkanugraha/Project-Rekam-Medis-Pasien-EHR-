const hre = require("hardhat");

async function main() {
  // Ganti "CoffeeTraceability" dengan nama contract yang ada di dalam file .sol Anda
  const ContractFactory = await hre.ethers.getContractFactory("EHR");
  
  const contract = await ContractFactory.deploy();
  await contract.waitForDeployment();

  console.log("Deployment berhasil");
  console.log("Alamat kontrak:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});