// @ts-ignore
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const api = axios.create({
  baseURL: "https://lz180195.protheus.cloudtotvs.com.br:2157/rest/",
  timeout: 40000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Função para buscar empresas - FORÇANDO o TenantId inicial
export const buscarEmpresasDinamico = async (vendedorId: string) => {
  return api.get(`api/vendedores/v1/empresas/${vendedorId}`, {
    headers: {
      // Importante: O Protheus Cloud exige um contexto para responder
      "TenantId": "01,0101" 
    }
  });
};

api.interceptors.request.use(async (config: any) => {
  const token = await AsyncStorage.getItem("protheus_access_token");
  const empresa = await AsyncStorage.getItem("@empresa_ativa");
  const filial = await AsyncStorage.getItem("@filial_ativa");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Só injeta TenantId se já tivermos selecionado a empresa
  if (empresa && filial) {
    config.headers["TenantId"] = `${empresa},${filial}`;
  }

  return config;
});

export default api;
