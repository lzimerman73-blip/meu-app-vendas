import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { TextInput, Button, Title, Avatar } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api/api";

interface LoginScreenProps {
  onLoginSuccess: (token: string, refreshToken: string, userId: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Função simplificada para desenvolvimento
  const getPushToken = async () => {
    return "TOKEN_DEV_SIMULADO";
  };

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Atenção", "Preencha o usuário e a senha.");
      return;
    }

    setLoading(true);
    console.log("--- Iniciando Login ---");

    try {
      const params = new URLSearchParams();
      params.append("grant_type", "password");
      params.append("username", username);
      params.append("password", password);

      const response = await api.post(
        "api/oauth2/v1/token",
        params.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
        },
      );

      if (response.data.access_token) {
        console.log("✅ Autenticado com sucesso.");

        // Salva dados essenciais
        await AsyncStorage.setItem(
          "protheus_access_token",
          response.data.access_token,
        );
        await AsyncStorage.setItem("@vendedor_id", username);

        if (response.data.refresh_token) {
          await AsyncStorage.setItem(
            "protheus_refresh_token",
            response.data.refresh_token,
          );
        }

        /* FUNÇÃO DE TOKEN DESATIVADA EM DESENVOLVIMENTO
          Quando for voltar com as notificações, basta reativar o bloco abaixo 
          e configurar o getPushToken real.
        */
        /*
        try {
           const pushToken = await getPushToken();
           await api.post("api/wstoken", { 
             userid: username, 
             token: pushToken, 
             plataforma: Platform.OS 
           }, {
             headers: { Authorization: `Bearer ${response.data.access_token}` }
           });
        } catch (e) { console.log("Erro silencioso no wstoken"); }
        */

        onLoginSuccess(
          response.data.access_token,
          response.data.refresh_token || "",
          username,
        );
      }
    } catch (e: any) {
      console.error("🚨 Erro no Login:", e.response?.data || e.message);

      const statusCode = e.response?.status;
      let mensagemExibicao = "Erro ao conectar com o servidor.";

      if (statusCode === 401) mensagemExibicao = "Usuário ou senha inválidos.";
      else if (statusCode === 403)
        mensagemExibicao = "Acesso negado pelo Protheus.";
      else if (statusCode === 404)
        mensagemExibicao = "Servidor não encontrado (404).";
      else if (statusCode === 500)
        mensagemExibicao = "Erro interno no servidor Protheus.";

      Alert.alert("Erro de Acesso", mensagemExibicao);
    } finally {
      setLoading(false);
      console.log("--- Fim do processo de Login ---");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.appContainer}>
          <Avatar.Icon
            size={100}
            icon="briefcase-check"
            style={styles.iconHeader}
            color="white"
          />

          <View style={styles.loginBox}>
            <Title style={styles.title}>Força de Vendas</Title>

            <TextInput
              label="Usuário Protheus"
              value={username}
              onChangeText={setUsername}
              disabled={loading}
              mode="outlined"
              autoCapitalize="none"
              style={styles.input}
              activeOutlineColor="#005492"
            />

            <TextInput
              label="Senha"
              value={password}
              onChangeText={setPassword}
              disabled={loading}
              mode="outlined"
              secureTextEntry
              style={styles.input}
              activeOutlineColor="#005492"
            />

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              ACESSAR SISTEMA
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    backgroundColor: "#f0f2f5",
  },
  appContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  iconHeader: { backgroundColor: "#005492", marginBottom: 20, elevation: 4 },
  loginBox: {
    width: "100%",
    maxWidth: 400,
    padding: 25,
    borderRadius: 12,
    backgroundColor: "white",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 25,
    textAlign: "center",
    color: "#333",
  },
  input: { marginBottom: 15, backgroundColor: "white" },
  button: { marginTop: 10, borderRadius: 6, backgroundColor: "#005492" },
  buttonContent: { height: 50 },
});

export default LoginScreen;
