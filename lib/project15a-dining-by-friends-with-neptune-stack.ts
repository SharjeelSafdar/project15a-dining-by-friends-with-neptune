import * as cdk from "@aws-cdk/core";
import * as cognito from "@aws-cdk/aws-cognito";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as neptune from "@aws-cdk/aws-neptune";
import * as appsync from "@aws-cdk/aws-appsync";
import * as events from "@aws-cdk/aws-events";
import * as eventTargets from "@aws-cdk/aws-events-targets";
import * as lambda from "@aws-cdk/aws-lambda";

import {
  EVENT_SOURCE,
  requestTemplate,
  responseTemplate,
} from "../vtlTemplates/index";

export class P15aGraphQlApiStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /* ******************************************************** */
    /* ******************* Cognito UserPool ******************* */
    /* ******************************************************** */
    const userPool = new cognito.UserPool(this, "P15aUserPool", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true,
      },
      signInCaseSensitive: true,
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
      },
      autoVerify: {
        email: true,
      },
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.LINK,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      standardAttributes: {
        email: { required: true, mutable: false },
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
    });

    const userPoolClient = userPool.addClient("P15aUserPoolClient", {
      authFlows: {
        userPassword: true,
      },
    });

    new cdk.CfnOutput(this, "P15aUserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });

    const userPoolDomain = userPool.addDomain("P15aUserPoolDomain", {
      cognitoDomain: {
        domainPrefix: "dining-by-friends-p15a",
      },
    });

    new cdk.CfnOutput(this, "P15aUserPoolDomain", {
      value: userPoolDomain.domainName,
    });

    /* ********************************************************* */
    /* ************ Neptune DB Cluster and Instance ************ */
    /* ********************************************************* */
    const vpc = new ec2.Vpc(this, "P15aVpc", {
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "Ingress",
          subnetType: ec2.SubnetType.ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    const securityGroup = new ec2.SecurityGroup(this, "P15aSecurityGroup", {
      vpc,
      securityGroupName: "P15aSecurityGroup",
      description: "Security group for Neptune DB",
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(
      securityGroup,
      ec2.Port.tcp(8182),
      "Rule for accessing NeptuneDB instance."
    );

    const cluster = new neptune.DatabaseCluster(this, "P15aNeptuneCluster", {
      dbClusterName: "P15a-Neptune-Cluster",
      vpc,
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.ISOLATED }),
      securityGroups: [securityGroup],
      instanceType: neptune.InstanceType.T3_MEDIUM,
      engineVersion: neptune.EngineVersion.V1_0_4_1,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });
    cluster.connections.allowDefaultPortFromAnyIpv4("Open to the world");

    /* ******************************************************** */
    /* *************** Create New Person Lambda *************** */
    /* ******************************************************** */
    const newPersonLambda = new lambda.Function(this, "P15aNewPersonLambda", {
      functionName: "p15a-new-person-lambda",
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("lambdaFns/newPerson"),
      handler: "index.handler",
      memorySize: 1024,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.ISOLATED,
      },
      securityGroups: [securityGroup],
      environment: {
        NEPTUNE_READER: cluster.clusterReadEndpoint.socketAddress,
        NEPTUNE_WRITER: cluster.clusterEndpoint.socketAddress,
      },
      timeout: cdk.Duration.seconds(10),
    });

    userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,
      newPersonLambda
    );

    /* ********************************************************* */
    /* ****************** AppSync GraphQL API ****************** */
    /* ********************************************************* */
    const gqlApi = new appsync.GraphqlApi(this, "P15aGraphQlApi", {
      name: "P15a-GraphQL-Api",
      schema: appsync.Schema.fromAsset("apiSchema/diningByFriends.gql"),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.IAM,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365)),
          },
        },
      },
    });

    /* ********************************************************** */
    /* *************** GraphQL API Query Resolver *************** */
    /* ********************************************************** */
    const appSyncQueryLambda = new lambda.Function(
      this,
      "P15aAppSyncQueryLambda",
      {
        functionName: "p15a-appsync-query-lambda",
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset("lambdaFns/appSyncQueryLambda"),
        handler: "index.handler",
        memorySize: 1024,
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.ISOLATED,
        },
        securityGroups: [securityGroup],
        environment: {
          NEPTUNE_READER: cluster.clusterReadEndpoint.socketAddress,
          NEPTUNE_WRITER: cluster.clusterEndpoint.socketAddress,
        },
        timeout: cdk.Duration.seconds(10),
      }
    );

    const queryLambdaDS = gqlApi.addLambdaDataSource(
      "P15aLambdaDS",
      appSyncQueryLambda
    );

    queryLambdaDS.createResolver({
      typeName: "Query",
      fieldName: "getPerson",
    });

    /* ************************************************************** */
    /* *************** GraphQL API Mutation Resolvers *************** */
    /* ************************************************************** */
    const httpEventBridgeDS = gqlApi.addHttpDataSource(
      "P15aHttpEventBridgeDS",
      `https://events.${this.region}.amazonaws.com/`,
      {
        name: "p15aHttpEventBridgeDS",
        description: "Sending events to EventBridge on AppSync mutations",
        authorizationConfig: {
          signingRegion: this.region,
          signingServiceName: "events",
        },
      }
    );
    events.EventBus.grantAllPutEvents(httpEventBridgeDS);

    const addPersonArgs = `\\\"id\\\": \\\"$util.autoId()\\\", \\\"newPerson\\\": {\\\"username\\\": \\\"$ctx.args.newPerson.username\\\", \\\"email\\\": \\\"$ctx.args.newPerson.email\\\", \\\"firstName\\\": \\\"$ctx.args.newPerson.firstName\\\", \\\"lastName\\\": \\\"$ctx.args.newPerson.lastName\\\", \\\"cityId\\\": \\\"$ctx.args.newPerson.cityId\\\"}`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.ADD_PERSON,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(addPersonArgs, MutationType.ADD_PERSON)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const addStateArgs = `\\\"id\\\": \\\"$util.autoId()\\\", \\\"name\\\": \\\"$ctx.args.name\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.ADD_STATE,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(addStateArgs, MutationType.ADD_STATE)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    const addCityArgs = `\\\"id\\\": \\\"$util.autoId()\\\", \\\"name\\\": \\\"$ctx.args.name\\\", \\\"stateId\\\": \\\"$ctx.args.stateId\\\"`;
    httpEventBridgeDS.createResolver({
      typeName: "Mutation",
      fieldName: MutationType.ADD_CITY,
      requestMappingTemplate: appsync.MappingTemplate.fromString(
        requestTemplate(addCityArgs, MutationType.ADD_CITY)
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        responseTemplate()
      ),
    });

    /* ************************************************************** */
    /* ******** Lambda Function to Resolve AppSync Mutations ******** */
    /* ************************************************************** */
    const appSyncMutationLambda = new lambda.Function(
      this,
      "P15aAppSyncMutationLambda",
      {
        functionName: "p15a-appsync-mutation-lambda",
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset("lambdaFns/appSyncMutationLambda"),
        handler: "index.handler",
        memorySize: 1024,
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.ISOLATED,
        },
        securityGroups: [securityGroup],
        environment: {
          NEPTUNE_READER: cluster.clusterReadEndpoint.socketAddress,
          NEPTUNE_WRITER: cluster.clusterEndpoint.socketAddress,
        },
        timeout: cdk.Duration.seconds(10),
      }
    );

    /* **************************************************************** */
    /* ******** EventBridge Rule to Invoke the Mutation Lambda ******** */
    /* **************************************************************** */
    new events.Rule(this, "P15aEventRule", {
      description:
        "Rule to invoke the mutation lambda when a mutation is run in AppSync",
      eventPattern: {
        source: [EVENT_SOURCE],
        detailType: [
          MutationType.ADD_PERSON,
          MutationType.ADD_UPDATE_FIRST_NAME,
          MutationType.ADD_UPDATE_LAST_NAME,
          MutationType.DELETE_PERSON,
          MutationType.ADD_CITY,
          MutationType.UPDATE_CITY_NAME,
          MutationType.DELETE_CITY,
          MutationType.ADD_STATE,
          MutationType.UPDATE_STATE_NAME,
          MutationType.DELETE_STATE,
          MutationType.ADD_CUISINE,
          MutationType.UPDATE_CUISINE_NAME,
          MutationType.DELETE_CUISINE,
          MutationType.ADD_RESTAURANT,
          MutationType.UPDATE_RESTAURANT_NAME,
          MutationType.UPDATE_RESTAURANT_ADDRESS,
          MutationType.DELETE_RESTAURANT,
          MutationType.ADD_REVIEW,
          MutationType.ADD_REVIEW_RATING,
          MutationType.ADD_FRIENDS_EDGE,
        ],
      },
      targets: [new eventTargets.LambdaFunction(appSyncMutationLambda)],
    });

    cdk.Tags.of(this).add("Project", "P15A-Dining-By-Friends-Neptune");
  }
}

enum MutationType {
  ADD_PERSON = "addPerson",
  ADD_UPDATE_FIRST_NAME = "addUpdateFirstName",
  ADD_UPDATE_LAST_NAME = "addUpdateLastName",
  DELETE_PERSON = "deletePerson",
  ADD_CITY = "addCity",
  UPDATE_CITY_NAME = "updateCityName",
  DELETE_CITY = "deleteCity",
  ADD_STATE = "addState",
  UPDATE_STATE_NAME = "updateStateName",
  DELETE_STATE = "deleteState",
  ADD_CUISINE = "addCuisine",
  UPDATE_CUISINE_NAME = "updateCuisineName",
  DELETE_CUISINE = "deleteCuisine",
  ADD_RESTAURANT = "addRestaurant",
  UPDATE_RESTAURANT_NAME = "updateRestaurantName",
  UPDATE_RESTAURANT_ADDRESS = "updateRestaurantAddress",
  DELETE_RESTAURANT = "deleteRestaurant",
  ADD_REVIEW = "addReview",
  ADD_REVIEW_RATING = "addReviewRating",
  ADD_FRIENDS_EDGE = "addFriendsEdge",
}
