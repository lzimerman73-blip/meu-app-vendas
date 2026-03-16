import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { TextInput, Button, Title, Avatar, useTheme } from "react-native-paper";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage"; // 1. Adicione este import
import api from "../api/api";

interface LoginScreenProps {
  onLoginSuccess: (token: string, refreshToken: string, userId: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const getPushToken = async () => {
    if (!Device.isDevice) return "TOKEN_SIMULADOR";
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") return null;
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: "SEU_PROJECT_ID_AQUI",
      });
      return tokenData.data;
    } catch (err) {
      console.error("❌ Erro ao gerar token:", err);
      return null;
    }
  };

  const salvarTokenNoProtheus = async (
    pushToken: string,
    userId: string,
    accessToken: string,
  ) => {
    try {
      await api.post(
        "/api/wstoken",
        {
          userid: userId,
          token: pushToken,
          plataforma: Platform.OS,
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
    } catch (error: any) {
      console.log("❌ Erro no registro de token");
      throw error;
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Atenção", "Preencha o usuário e a senha.");
      return;
    }

    setLoading(true);
    try {
      // 1. Mudança na montagem do Body para garantir compatibilidade Cloud
      const params = new URLSearchParams();
      params.append("grant_type", "password");
      params.append("username", username);
      params.append("password", password);

      // 2. IMPORTANTE: Removida a barra '/' antes de 'api'
      // Isso garante que ele use o '.../rest' definido na baseURL
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
        // SALVAR NO STORAGE
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

        // 3. Pegar Push Token (com tratamento de erro interno)
        const pushToken = await getPushToken();
        const tokenFinal = pushToken || "TOKEN_TESTE_" + Platform.OS;

        // 4. Salvar token (Removida a barra inicial aqui também)
        try {
          await api.post(
            "api/wstoken",
            {
              userid: username,
              token: tokenFinal,
              plataforma: Platform.OS,
            },
            {
              headers: {
                Authorization: `Bearer ${response.data.access_token}`,
              },
            },
          );
        } catch (tokenErr) {
          console.log(
            "⚠️ Token não registrado no Protheus, mas login prossegue.",
          );
        }

        onLoginSuccess(
          response.data.access_token,
          response.data.refresh_token || "",
          username,
        );
      }
    } catch (e: any) {
      console.error("🚨 Erro detalhado no Login:", e);
      const statusCode = e.response?.status;
      let mensagemExibicao = "Erro ao conectar com o servidor.";

      if (statusCode === 401) mensagemExibicao = "Usuário ou senha inválidos.";
      else if (statusCode === 403)
        mensagemExibicao = "Acesso negado pelo Protheus.";
      else if (statusCode === 404)
        mensagemExibicao =
          "Endpoint de Login não encontrado (404). Verifique a URL.";
      else if (statusCode === 500)
        mensagemExibicao = "Erro interno no servidor Protheus.";

      Alert.alert("Erro de Acesso", mensagemExibicao);
    } finally {
      setLoading(false);
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
          {/* Ícone Neutro no lugar da Logo */}
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
