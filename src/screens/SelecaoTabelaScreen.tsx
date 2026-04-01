import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { List, Searchbar, Text, Surface, Divider } from "react-native-paper";
import api from "../api/api";

const SelecaoTabelaScreen = ({ route, navigation }: any) => {
  // Recebemos o cliente e loja para passar adiante no fluxo do pedido
  const { cliente, loja, vendedorId, vendedorNome, saldoFlex } = route.params;

  const [loading, setLoading] = useState(true);
  const [tabelas, setTabelas] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const carregarTabelas = async () => {
      try {
        // AJUSTE: Enviando o vendedorId como parâmetro para a API
        const response = await api.get("/api/gettabelavendedor", {
          params: {
            vendedor: vendedorId,
          },
        });

        setTabelas(response.data.tabelas);
      } catch (error) {
        console.error("Erro ao carregar tabelas:", error);
        Alert.alert(
          "Erro",
          "Não foi possível carregar as tabelas do vendedor.",
        );
      } finally {
        setLoading(false);
      }
    };

    if (vendedorId) {
      carregarTabelas();
    }
  }, [vendedorId]);

  const tabelasFiltradas = tabelas.filter(
    (t: any) =>
      t.descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.includes(searchQuery),
  );

  // 1. Alteramos para receber o objeto 'item' completo da lista
  const selecionarTabela = (item: any) => {
    navigation.navigate("SelecaoProdutos", {
      ...route.params, // <--- ISSO AQUI copia cliente, loja, vendedorId, vendedorNome e saldoFlex AUTOMATICAMENTE
      tabela: item.id, // Aqui você define o ID da tabela
      tabelaDesc: item.descricao, // Aqui você envia a descrição para o PDF
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#005492" />
        <Text style={{ marginTop: 10 }}>Buscando tabelas ativas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.header}>
        <Text style={styles.instrucao}>Selecione a Tabela de Preços</Text>
      </Surface>

      <Searchbar
        placeholder="Buscar tabela..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      <FlatList
        data={tabelasFiltradas}
        keyExtractor={(item: any) => item.id}
        ItemSeparatorComponent={() => <Divider />}
        renderItem={({ item }: any) => (
          <List.Item
            title={item.descricao}
            description={`Código: ${item.id}`}
            left={(props) => (
              //<List.Icon {...props} icon="table-search" color="#005492" />
              <List.Icon {...props} icon="file-table-outline" color="#005492" />
            )}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => selecionarTabela(item)}
            titleStyle={styles.tituloTabela}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhuma tabela vigente encontrada.</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: 15, backgroundColor: "#fff", elevation: 2 },
  instrucao: { fontSize: 16, fontWeight: "bold", color: "#333" },
  searchBar: { margin: 10, backgroundColor: "#fff", elevation: 1 },
  tituloTabela: { fontWeight: "bold", color: "#005492" },
  empty: { textAlign: "center", marginTop: 20, color: "#999" },
});

export default SelecaoTabelaScreen;
