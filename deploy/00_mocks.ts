import { DeployFunction } from "hardhat-deploy/types";
import { MockERC20__factory, OTCSwap__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy } = await Ship.init(hre);

  if (!hre.network.tags.prod) {
    await deploy(MockERC20__factory, {
      aliasName: "TestToken1",
      args: ["TestToken1", "TT1"],
    });
    await deploy(MockERC20__factory, {
      aliasName: "TestToken2",
      args: ["TestToken2", "TT2"],
    });
  }
};

export default func;
func.tags = ["mocks"];
