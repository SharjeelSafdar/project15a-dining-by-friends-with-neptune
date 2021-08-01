import * as cdk from "@aws-cdk/core";
import { SynthUtils } from "@aws-cdk/assert";
import { P15aGraphQlApiStack } from "../lib/project15a-dining-by-friends-with-neptune-stack";

const createTestStack = (app: cdk.App) =>
  new P15aGraphQlApiStack(app, "MyTestStack");

test("Snapshot Test", () => {
  const app = new cdk.App();
  // WHEN
  const stack = createTestStack(app);
  // THEN
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});
