import { deployments } from "hardhat";
import {
  Collectionstaker__factory,
  LinearCurve__factory,
  MockERC721__factory,
  Token__factory,
} from "../types";
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

  const collectionStaker = await scaffold.ship.connect(Collectionstaker__factory);
  const mockERC721 = await scaffold.ship.connect(MockERC721__factory);
  const linearCurve = await scaffold.ship.connect(LinearCurve__factory);

  const currentTime = Math.floor(Date.now() / 1000);

  console.log(currentTime);

  const tx = await collectionStaker.createIncentiveETH(
    mockERC721.address,
    linearCurve.address,
    0,
    0,
    [],
    [],
    // 0,
    // 0,
    currentTime + 60,
    currentTime + 60 + 3600,
  );
  console.log("create new vault at", tx.hash);
  await tx.wait();
};

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  });
