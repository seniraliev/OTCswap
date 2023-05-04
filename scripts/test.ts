import { deployments } from "hardhat";
import { Token__factory } from "../types";
import { Ship } from "../utils";
import { constants } from "ethers";

const main = async () => {
  const setup = deployments.createFixture(async (hre) => {
    const ship = await Ship.init(hre);
    const { accounts, users } = ship;
    // await deployments.fixture(["test"]);

    return {
      ship,
      accounts,
      users,
    };
  });

  const scaffold = await setup();

  const token = await scaffold.ship.connect(Token__factory);

  const tx = await token.transfer(constants.AddressZero, 100);
  console.log("Transfer token at", tx.hash);
  await tx.wait();
};

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  });
