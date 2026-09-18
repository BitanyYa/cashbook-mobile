import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import HomeScreen from './src/screens/HomeScreen';
import CreateBusinessScreen from './src/screens/CreateBusinessScreen';
import BooksScreen from './src/screens/BooksScreen';
import CreateBookScreen from './src/screens/CreateBookScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import CreateTransactionScreen from './src/screens/CreateTransactionScreen';
import TransactionDetailsScreen from './src/screens/TransactionDetailsScreen';
import CategoriesScreen from './src/screens/CategoriesScreen';
import CreateCategoryScreen from './src/screens/CreateCategoryScreen';

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Home: undefined;
  CreateBusiness: undefined;
  Books: {
    businessId: string;
    businessName: string;
    currency: string;
  };
  CreateBook: {
    businessId: string;
    businessName: string;
    currency: string;
  };
  Transactions: {
    businessId: string;
    businessName: string;
    bookId: string;
    bookName: string;
    currency: string;
  };
  CreateTransaction: {
    businessId: string;
    businessName: string;
    bookId: string;
    bookName: string;
    currency: string;
    transactionId?: string;
  };
  TransactionDetails: {
    businessId: string;
    businessName: string;
    bookId: string;
    bookName: string;
    currency: string;
    transactionId: string;
  };
  Categories: {
    businessId: string;
    businessName: string;
    bookId?: string;
    bookName?: string;
    currency?: string;
  };
  CreateCategory: {
    businessId: string;
    businessName: string;
    bookId?: string;
    bookName?: string;
    currency?: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
        />

        <Stack.Screen
          name="SignUp"
          component={SignUpScreen}
        />

        <Stack.Screen
          name="Home"
          component={HomeScreen}
        />

        <Stack.Screen
          name="CreateBusiness"
          component={CreateBusinessScreen}
        />

        <Stack.Screen
          name="Books"
          component={BooksScreen}
        />

        <Stack.Screen
          name="CreateBook"
          component={CreateBookScreen}
        />

        <Stack.Screen
          name="Transactions"
          component={TransactionsScreen}
        />

        <Stack.Screen
          name="CreateTransaction"
          component={CreateTransactionScreen}
        />

        <Stack.Screen
          name="TransactionDetails"
          component={TransactionDetailsScreen}
        />

        <Stack.Screen
          name="Categories"
          component={CategoriesScreen}
        />

        <Stack.Screen
          name="CreateCategory"
          component={CreateCategoryScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}