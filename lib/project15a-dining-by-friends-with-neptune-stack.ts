import * as cdk from "@aws-cdk/core";
import * as cognito from "@aws-cdk/aws-cognito";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as neptune from "@aws-cdk/aws-neptune";
import * as appsync from "@aws-cdk/aws-appsync";
import * as events from "@aws-cdk/aws-events";
import * as eventTargets from "@aws-cdk/aws-events-targets";
import * as lambda from "@aws-cdk/aws-lambda";

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
    });

    userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,
      newPersonLambda
    );

    cdk.Tags.of(this).add("Project", "P15A-Dining-By-Friends-Neptune");
  }
}
