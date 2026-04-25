// @ts-ignore
import axios from "axios/dist/axios.js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const api = axios.create({
  baseURL: "https://lz180195.protheus.cloudtotvs.com.br:2157/rest/",
  timeout: 40000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
});

/**
 * INTERCEPTOR DE REQUISIÇÃO
 * Resolve o erro 403 trocando o TenantId conforme a empresa selecionada
 */
api.interceptors.request.use(async (config: any) => {
  try {
    const token = await AsyncStorage.getItem("protheus_access_token");
    const empresaSalva = await AsyncStorage.getItem("@empresa_ativa");
    const filialSalva = await AsyncStorage.getItem("@filial_ativa");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Se a chamada JÁ tiver um TenantId (como no loop do chaveiro), não mexemos
    if (!config.headers["TenantId"]) {
      if (empresaSalva && filialSalva) {
        // Monta o TenantId dinâmico para evitar o 403 nas telas de Clientes/Produtos
        config.headers["TenantId"] = `01,${empresaSalva}${filialSalva}`;
      } else {
        // Fallback para quando o app ainda não tem empresa definida
        config.headers["TenantId"] = "01,1202";
      }
    }

    console.log(
      `🚀 [REQ] URL: ${config.url} | TenantId: ${config.headers["TenantId"]}`,
    );
    return config;
  } catch (error) {
    return config;
  }
});

/**
 * FUNÇÃO "CHAVEIRO" - Busca a lista de empresas testando as portas (filiais)
 */
export const buscarEmpresasDinamico = async (vendedor: string) => {
  const filiaisParaTestar = ["1001", "1201", "1202", "1203", "1301"];

  for (const filial of filiaisParaTestar) {
    try {
      const response = await api.get(`api/getempresas?vendedor=${vendedor}`, {
        headers: {
          // Forçamos o TenantId específico para o teste de "porta aberta"
          TenantId: `01,${filial}`,
        },
      });

      if (response.data && response.data.items) {
        console.log(`✨ Porta aberta via filial ${filial}!`);
        return response.data.items;
      }
    } catch (error: any) {
      // Se der 403, apenas ignora e tenta a próxima filial da lista
      if (error.response?.status !== 403) {
        console.log(
          `🛑 Erro inesperado na filial ${filial}:`,
          error.response?.status,
        );
      }
      continue;
    }
  }
  throw new Error("Usuário não possui acesso a nenhuma das filiais do grupo.");
};

export default api;
