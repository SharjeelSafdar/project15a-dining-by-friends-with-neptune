import {
  expect as expectCDK,
  matchTemplate,
  MatchStyle,
} from "@aws-cdk/assert";
import * as cdk from "@aws-cdk/core";
import { P15aGraphQlApiStack } from "../lib/project15a-dining-by-friends-with-neptune-stack";

const createTestStack = (app: cdk.App) =>
  new P15aGraphQlApiStack(app, "MyTestStack");

test("Empty Stack", () => {
  const app = new cdk.App();
  // WHEN
  const stack = createTestStack;
  // THEN
  expectCDK(stack).to(
    matchTemplate(
      {
        Resources: {},
      },
      MatchStyle.EXACT
    )
  );
});
