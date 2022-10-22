export interface CognitoUser {
  UserAttributes: [{ Name: string; Value: any }];
  UserName: string;
}
