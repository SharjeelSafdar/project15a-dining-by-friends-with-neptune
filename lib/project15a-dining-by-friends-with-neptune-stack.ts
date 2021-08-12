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
          authorizationType: appsync.AuthorizationType.API_KEY,
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

    Object.values(QueryType).forEach(fieldName => {
      queryLambdaDS.createResolver({
        typeName: "Query",
        fieldName,
      });
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

    const mutationArgs = [
      // Mutation Arguments for addPerson
      `\\\"id\\\": \\\"$util.autoId()\\\", \\\"newPerson\\\": { \\\"username\\\": \\\"$ctx.args.newPerson.username\\\", \\\"email\\\": \\\"$ctx.args.newPerson.email\\\", \\\"firstName\\\": \\\"$ctx.args.newPerson.firstName\\\", \\\"lastName\\\": \\\"$ctx.args.newPerson.lastName\\\", \\\"cityId\\\": \\\"$ctx.args.newPerson.cityId\\\" }`,
      // Mutation Arguments for addUpdateFirstName
      `\\\"personId\\\": \\\"$ctx.args.personId\\\", \\\"firstName\\\": \\\"$ctx.args.firstName\\\"`,
      // Mutation Arguments for addUpdateLastName
      `\\\"personId\\\": \\\"$ctx.args.personId\\\", \\\"lastName\\\": \\\"$ctx.args.lastName\\\"`,
      // Mutation Arguments for deletePerson
      `\\\"personId\\\": \\\"$ctx.args.personId\\\"`,
      // Mutation Arguments for addCity
      `\\\"id\\\": \\\"$util.autoId()\\\", \\\"name\\\": \\\"$ctx.args.name\\\", \\\"stateId\\\": \\\"$ctx.args.stateId\\\"`,
      // Mutation Arguments for updateCityName
      `\\\"cityId\\\": \\\"$ctx.args.cityId\\\", \\\"newName\\\": \\\"$ctx.args.newName\\\"`,
      // Mutation Arguments for deleteCity
      `\\\"cityId\\\": \\\"$ctx.args.cityId\\\"`,
      // Mutation Arguments for addState
      `\\\"id\\\": \\\"$util.autoId()\\\", \\\"name\\\": \\\"$ctx.args.name\\\"`,
      // Mutation Arguments for updateStateName
      `\\\"stateId\\\": \\\"$ctx.args.stateId\\\", \\\"newName\\\": \\\"$ctx.args.newName\\\"`,
      // Mutation Arguments for deleteState
      `\\\"stateId\\\": \\\"$ctx.args.stateId\\\"`,
      // Mutation Arguments for addCuisine
      `\\\"id\\\": \\\"$util.autoId()\\\", \\\"name\\\": \\\"$ctx.args.name\\\"`,
      // Mutation Arguments for updateCuisineName
      `\\\"cuisineId\\\": \\\"$ctx.args.cuisineId\\\", \\\"newName\\\": \\\"$ctx.args.newName\\\"`,
      // Mutation Arguments for deleteCuisine
      `\\\"cuisineId\\\": \\\"$ctx.args.cuisineId\\\"`,
      // Mutation Arguments for addRestaurant
      `\\\"id\\\": \\\"$util.autoId()\\\", \\\"newRestaurant\\\": { \\\"name\\\": \\\"$ctx.args.newRestaurant.name\\\", \\\"address\\\": \\\"$ctx.args.newRestaurant.address\\\", \\\"cityId\\\": \\\"$ctx.args.newRestaurant.cityId\\\", \\\"cuisineId\\\": \\\"$ctx.args.newRestaurant.cuisineId\\\" }`,
      // Mutation Arguments for updateRestaurantName
      `\\\"restaurantId\\\": \\\"$ctx.args.restaurantId\\\", \\\"newName\\\": \\\"$ctx.args.newName\\\"`,
      // Mutation Arguments for updateRestaurantAddress
      `\\\"restaurantId\\\": \\\"$ctx.args.restaurantId\\\", \\\"newAddress\\\": \\\"$ctx.args.newAddress\\\"`,
      // Mutation Arguments for deleteRestaurant
      `\\\"restaurantId\\\": \\\"$ctx.args.restaurantId\\\"`,
      // Mutation Arguments for addReview
      `\\\"id\\\": \\\"$util.autoId()\\\", \\\"createdAt\\\": $util.time.nowEpochSeconds(), \\\"newReview\\\": { \\\"rating\\\": $ctx.args.newReview.rating, \\\"body\\\": \\\"$ctx.args.newReview.body\\\", \\\"personId\\\": \\\"$ctx.args.newReview.personId\\\", \\\"restaurantId\\\": \\\"$ctx.args.newReview.restaurantId\\\" }`,
      // Mutation Arguments for deleteReview
      `\\\"reviewId\\\": \\\"$ctx.args.reviewId\\\"`,
      // Mutation Arguments for addReviewRating
      `\\\"id\\\": \\\"$util.autoId()\\\", \\\"reviewDate\\\": $util.time.nowEpochSeconds(), \\\"newReviewRating\\\": { \\\"thumbsUp\\\": $ctx.args.newReviewRating.thumbsUp, \\\"reviewId\\\": \\\"$ctx.args.newReviewRating.reviewId\\\", \\\"personId\\\": \\\"$ctx.args.newReviewRating.personId\\\" }`,
      // Mutation Arguments for deleteReviewRating
      `\\\"reviewRatingId\\\": \\\"$ctx.args.reviewRatingId\\\"`,
      // Mutation Arguments for addFriendsEdge
      `\\\"fromId\\\": \\\"$ctx.args.fromId\\\", \\\"toId\\\": \\\"$ctx.args.toId\\\", \\\"id\\\": \\\"$util.autoId()\\\"`,
      // Mutation Arguments for deleteFriendsEdge
      `\\\"friendsEdgeId\\\": \\\"$ctx.args.friendsEdgeId\\\"`,
    ];

    Object.values(MutationType).forEach((fieldName, index) => {
      httpEventBridgeDS.createResolver({
        typeName: "Mutation",
        fieldName,
        requestMappingTemplate: appsync.MappingTemplate.fromString(
          requestTemplate(mutationArgs[index], fieldName)
        ),
        responseMappingTemplate: appsync.MappingTemplate.fromString(
          responseTemplate()
        ),
      });
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
        detailType: Object.values(MutationType),
      },
      targets: [new eventTargets.LambdaFunction(appSyncMutationLambda)],
    });

    cdk.Tags.of(this).add("Project", "P15A-Dining-By-Friends-Neptune");
  }
}

const QueryType = {
  GET_PERSON: "getPerson",
  GET_FRIENDS: "getFriends",
  GET_FRIENDS_OF_FRIENDS: "getFriendsOfFriends",
  FIND_PATH_BETWEEN_PEOPLE: "findPathBetweenPeople",
  HIGHEST_RATED_RESTAURANT_BY_CUISINE: "highestRatedRestaurantByCuisine",
  HIGHEST_RATED_RESTAURANTS: "highestRatedRestaurants",
  NEWEST_RESTAURANT_REVIEWS: "newestRestaurantReviews",
  RESTAURANTS_BY_FRIENDS_RECOMMENDATIONS: "restaurantsByFriendsRecommendations",
  RESTAURANTS_BY_FRIENDS_REVIEW_RATINGS: "restaurantsByFriendsReviewRatings",
  RESTAURANTS_RATED_OR_REVIEWED_BY_FRIENDS_IN_X_DAYS:
    "restaurantsRatedOrReviewedByFriendsinXDays",
  GET_ALL_STATES: "getAllStates",
  GET_ALL_CITIES: "getAllCities",
  GET_ALL_CUISINES: "getAllCuisines",
  GET_ALL_RESTAURANTS: "getAllRestaurants",
  GET_ALL_PERSONS: "getAllPersons",
  GET_ALL_REVIEWS: "getAllReviews",
  GET_ALL_REVIEW_RATINGS: "getAllReviewRatings",
};

const MutationType = {
  ADD_PERSON: "addPerson",
  ADD_UPDATE_FIRST_NAME: "addUpdateFirstName",
  ADD_UPDATE_LAST_NAME: "addUpdateLastName",
  DELETE_PERSON: "deletePerson",
  ADD_CITY: "addCity",
  UPDATE_CITY_NAME: "updateCityName",
  DELETE_CITY: "deleteCity",
  ADD_STATE: "addState",
  UPDATE_STATE_NAME: "updateStateName",
  DELETE_STATE: "deleteState",
  ADD_CUISINE: "addCuisine",
  UPDATE_CUISINE_NAME: "updateCuisineName",
  DELETE_CUISINE: "deleteCuisine",
  ADD_RESTAURANT: "addRestaurant",
  UPDATE_RESTAURANT_NAME: "updateRestaurantName",
  UPDATE_RESTAURANT_ADDRESS: "updateRestaurantAddress",
  DELETE_RESTAURANT: "deleteRestaurant",
  ADD_REVIEW: "addReview",
  DELETE_REVIEW: "deleteReview",
  ADD_REVIEW_RATING: "addReviewRating",
  DELETE_REVIEW_RATING: "deleteReviewRating",
  ADD_FRIENDS_EDGE: "addFriendsEdge",
  DELETE_FRIENDS_EDGE: "deleteFriendsEdge",
};
