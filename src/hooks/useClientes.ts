import { useState, useEffect } from "react";
import api from "../api/api";

export interface Cliente {
  codigo: string;
  loja: string; // [AJUSTE] Adicionado para suportar a nova estrutura da sua API
  nome: string;
  fantasia: string;
  cnpj: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export const useClientes = (vendedorId: string) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClientes = async () => {
    try {
      setLoading(true);
      // Chamada ao seu endpoint TLPP enviando o vendedor como parâmetro
      const response = await api.get(
        `/api/getclientesVendedor?vendedor=${vendedorId}`,
      );

      // Conforme seu TLPP, os dados vêm dentro da propriedade "bancos"
      // Verifique se no retorno do Protheus a chave é "loja" (minúsculo) ou "LOJA" (maiúsculo)
      setClientes(response.data.bancos || []);
      setError(null);
    } catch (err: any) {
      setError("Não foi possível carregar os clientes.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendedorId) fetchClientes();
  }, [vendedorId]);

  return { clientes, loading, error, refresh: fetchClientes };
};
