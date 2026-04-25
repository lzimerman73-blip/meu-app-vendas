import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import LoginScreen from "../screens/LoginScreen";
import SelecaoEmpresaScreen from "../screens/SelecaoEmpresaScreen";
import ClientesScreen from "../screens/ClientesScreen";
import DetalhesClienteScreen from "../screens/DetalhesClienteScreen";
import SelecaoTabelaScreen from "../screens/SelecaoTabelaScreen";
import SelecaoProdutosScreen from "../screens/SelecaoProdutosScreen";
import RevisaoPedidoScreen from "../screens/RevisaoPedidoScreen";
import PedidosOfflineScreen from "../screens/PedidosOfflineScreen";
import PedidosPendentes from "../screens/PedidosPendentes";
import { RootStackParamList } from "../types/navigation";
import CadastroClienteScreen from '../screens/CadastroClienteScreen';

const Stack = createStackNavigator<RootStackParamList>();

export const Routes = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: "#005492" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "bold" },
        }}
      >
        {/* 1. LOGIN */}
        <Stack.Screen name="Login" options={{ headerShown: false }}>
          {(props) => (
            <LoginScreen
              {...props}
              onLoginSuccess={(token, refresh, userId) =>
                props.navigation.replace("SelecaoEmpresa", {
                  vendedorId: userId,
                })
              }
            />
          )}
        </Stack.Screen>

        {/* 2. SELEÇÃO DE EMPRESA */}
        <Stack.Screen
          name="SelecaoEmpresa"
          options={{ title: "Selecionar Unidade", headerLeft: () => null }}
        >
          {(props: any) => (
            <SelecaoEmpresaScreen
              {...props}
              onConfirm={() => {
                const vId = props.route.params?.vendedorId;
                props.navigation.replace("Clientes", { vendedorId: vId });
              }}
            />
          )}
        </Stack.Screen>

        {/* 3. CLIENTES: Adicionamos a navegação para ListaPedidosSalvos aqui no componente interno se necessário, 
            mas como usamos navigation.navigate("PedidosOffline") na ClientesScreen, a rota abaixo já resolve. */}
        <Stack.Screen name="Clientes" options={{ title: "Meus Clientes" }}>
          {(props) => (
            <ClientesScreen
              {...props}
              vendedorId={props.route.params?.vendedorId}
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="PedidosOffline"
          component={PedidosOfflineScreen}
          options={{ title: "Pedidos Salvos" }}
        />

        <Stack.Screen
          name="DetalhesCliente"
          component={DetalhesClienteScreen}
          options={{ title: "Detalhes do Cliente" }}
        />

        <Stack.Screen
          name="SelecaoTabela"
          component={SelecaoTabelaScreen}
          options={{ title: "Tabela de Preços" }}
        />

        <Stack.Screen
          name="SelecaoProdutos"
          component={SelecaoProdutosScreen}
          options={{ title: "Catálogo de Produtos" }}
        />

        <Stack.Screen
          name="RevisaoPedido"
          component={RevisaoPedidoScreen}
          options={{ title: "Resumo do Pedido" }}
        />

        <Stack.Screen
          name="PedidosPendentes"
          component={PedidosPendentes}
          options={{ title: "Pedidos Pendentes", headerShown: true }}
        />

        <Stack.Screen
          name="CadastroCliente"
          component={CadastroClienteScreen}
          options={{ title: 'Cadastrar Novo Cliente' }}
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default Routes;
