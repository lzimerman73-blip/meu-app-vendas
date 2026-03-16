// @ts-ignore
import axios from "axios/dist/axios.js";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Definimos uma interface simples para o config caso o TS não reconheça
interface AxiosRequestConfigCustom {
  headers?: any;
  [key: string]: any;
}

const api = axios.create({
  // 1. Verifique se NÃO há espaços ou caracteres invisíveis aqui
  baseURL: "https://lz180195.protheus.cloudtotvs.com.br:2157/rest/",
  //baseURL: "http://189.126.145.63:2057/rest/",
  timeout: 40000,
  // 2. Força o uso de HTTPS e desabilita cache que pode forçar HTTP
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
});

/**
 * Diagnóstico de conexão atualizado para o novo projeto
 */
export const checkConnection = async () => {
  try {
    console.log("Iniciando Diagnóstico...");
    // Chamada neutra para validar se o serviço REST está respondendo
    const response = await api.get("/api/oauth2/v1/token", {
      timeout: 10000,
    });
    return { status: "OK", data: response.status };
  } catch (error: any) {
    if (error.response) {
      return {
        status: "ERRO_SERVIDOR",
        detail: `O servidor Protheus respondeu com erro: ${error.response.status}`,
      };
    } else if (error.request) {
      return {
        status: "ERRO_REDE",
        detail:
          "Não foi possível estabelecer conexão com o servidor. Verifique o endereço IP e a sua conexão de rede.",
      };
    } else {
      return { status: "ERRO_DESCONHECIDO", detail: error.message };
    }
  }
};

api.interceptors.request.use(async (config: any) => {
  const token = await AsyncStorage.getItem("protheus_access_token");
  const empresa = await AsyncStorage.getItem("@empresa_ativa");
  const filial = await AsyncStorage.getItem("@filial_ativa");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Se a empresa foi selecionada, injetamos no Header ou na URL
  if (empresa && filial) {
    // Padrão Protheus Cloud para troca de contexto:
    config.headers["TenantId"] = `${empresa},${filial}`;

    // Opcional: Adicionar via Params se seu TLPP ler via QueryString
    config.params = { ...config.params, empresa, filial };
  }

  return config;
});

export default api;
