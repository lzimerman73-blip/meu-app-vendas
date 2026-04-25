import React, { useState } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import {
  List,
  Searchbar,
  Card,
  Text,
  ActivityIndicator,
  Divider,
  Button,
} from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { useClientes, Cliente } from "../hooks/useClientes";

interface ClientesScreenProps {
  vendedorId: string;
}

const ClientesScreen: React.FC<ClientesScreenProps> = ({ vendedorId }) => {
  const { clientes, loading, refresh } = useClientes(vendedorId);
  const [searchQuery, setSearchQuery] = useState("");
  const navigation = useNavigation<any>();

  // --- FUNÇÃO DE FORMATAÇÃO DE CNPJ/CPF ---
  const formatarCNPJ = (val: string) => {
    if (!val) return "";
    const c = val.replace(/\D/g, "");
    if (c.length <= 11) {
      return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const filteredClientes = clientes.filter(
    (cliente) =>
      cliente.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cliente.codigo.includes(searchQuery),
  );

  const renderCliente = ({ item }: { item: Cliente }) => (
    <Card
      style={styles.card}
      onPress={() =>
        navigation.navigate("DetalhesCliente", {
          cliente: item,
          loja: item.loja,
          vendedorId: vendedorId,
        })
      }
    >
      <Card.Content>
        <View style={styles.headerRow}>
          <Text variant="titleMedium" style={styles.primaryColor}>
            {item.nome}
          </Text>
          <View style={styles.codeBadge}>
            <Text variant="labelSmall" style={styles.codeText}>
              {item.codigo} / {item.loja}
            </Text>
          </View>
        </View>

        <Text variant="bodyMedium" style={styles.secondaryText}>
          {item.fantasia}
        </Text>

        <Divider style={styles.divider} />

        <View style={styles.infoRow}>
          <List.Icon icon="map-marker" color="#666" />
          <Text variant="bodySmall">{`${item.cidade} - ${item.estado}`}</Text>
        </View>

        <View style={styles.infoRow}>
          <List.Icon icon="card-account-details" color="#666" />
          <Text variant="bodySmall" style={styles.infoText}>
            {formatarCNPJ(item.cnpj)}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* BOTÕES SUPERIORES */}
      <View style={styles.topButtonsContainer}>
        <Button
          mode="contained"
          icon="account-plus"
          buttonColor="#005492"
          textColor="#fff"
          onPress={() => navigation.navigate("CadastroCliente")}
          style={styles.button}
          labelStyle={styles.buttonLabel}
        >
          Novo Cliente
        </Button>
        <Button
          mode="contained"
          icon="swap-horizontal"
          buttonColor="#005492"
          textColor="#fff"
          onPress={() => navigation.navigate("SelecaoEmpresa", { vendedorId })}
          style={styles.button}
          labelStyle={styles.buttonLabel}
        >
          Trocar Filial
        </Button>
      </View>

      {/* BOTÕES DE PEDIDOS - AGORA PADRONIZADOS EM AZUL */}
      <View style={styles.buttonsContainer}>
        <Button
          mode="contained"
          icon="clipboard-list-outline"
          buttonColor="#005492"
          textColor="#fff"
          onPress={() => navigation.navigate("PedidosOffline", { vendedorId })}
          style={styles.button}
          labelStyle={styles.buttonLabel}
        >
          Pedidos Salvos
        </Button>
        <Button
          mode="contained"
          icon="clock-alert-outline"
          buttonColor="#005492"
          textColor="#fff"
          onPress={() =>
            navigation.navigate("PedidosPendentes", { vendedorId })
          }
          style={styles.button}
          labelStyle={styles.buttonLabel}
        >
          Pedidos Pendentes
        </Button>
      </View>

      {/* SEARCHBAR */}
      <Searchbar
        placeholder="Buscar cliente ou código..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      {/* LISTA DE CLIENTES */}
      {loading ? (
        <ActivityIndicator
          animating={true}
          color="#005492"
          style={{ marginTop: 20 }}
        />
      ) : (
        <FlatList
          data={filteredClientes}
          keyExtractor={(item) => `${item.codigo}-${item.loja}`}
          renderItem={renderCliente}
          contentContainerStyle={styles.listContent}
          onRefresh={refresh}
          refreshing={loading}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nenhum cliente encontrado.</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },

  // CONTAINERS DE BOTÕES
  topButtonsContainer: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingTop: 15, // Espaçamento superior igual ao que o título tinha
    paddingBottom: 0,
    gap: 10,
    backgroundColor: "#fff",
  },
  buttonsContainer: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1, // Movido o borderBottom do antigo título para cá
    borderBottomColor: "#e0e0e0",
  },
  button: {
    flex: 1,
    borderRadius: 8,
  },
  outlineButton: {
    borderColor: "#005492",
    borderWidth: 1,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: "600",
  },

  // SEARCHBAR
  searchBar: {
    margin: 10,
    elevation: 2,
    backgroundColor: "#fff",
    borderRadius: 8,
  },

  // LISTA E CARDS
  listContent: { paddingBottom: 20 },
  card: {
    marginHorizontal: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
    elevation: 3,
    borderRadius: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  primaryColor: {
    color: "#005492",
    fontWeight: "bold",
    flex: 1,
    paddingRight: 10,
  },
  codeBadge: {
    backgroundColor: "#e1e8ed",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  codeText: { color: "#444", fontWeight: "bold", fontSize: 11 },
  secondaryText: { color: "#757575", marginTop: 4 },
  divider: { marginVertical: 8 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 28,
    marginLeft: -8,
  },
  infoText: { marginLeft: 8, color: "#444", fontSize: 12 },
  emptyText: { textAlign: "center", marginTop: 50, color: "#999" },
});

export default ClientesScreen;