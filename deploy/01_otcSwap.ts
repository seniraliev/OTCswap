import { DeployFunction } from "hardhat-deploy/types";
import { OTCSwap__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, accounts } = await Ship.init(hre);

  await deploy(OTCSwap__factory);
};

export default func;
func.tags = ["otc-swap"];
func.dependencies = ["mocks"];
