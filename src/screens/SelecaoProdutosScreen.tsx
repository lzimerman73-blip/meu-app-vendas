import React, { useEffect, useState, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  Searchbar,
  Text,
  Surface,
  Button,
  IconButton,
  Badge,
  List,
  TextInput,
  Divider,
} from "react-native-paper";
import api from "../api/api";

const SelecaoProdutosScreen = ({ route, navigation }: any) => {
  const {
    cliente,
    loja,
    tabela,
    vendedorId,
    pedidoIdEdicao,
    carrinhoInicial,
    saldoFlex,
  } = route.params;

  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [carrinho, setCarrinho] = useState<{ [key: string]: any }>(
    carrinhoInicial || {},
  );

  // --- CÁLCULO DE ITENS (Movido para o topo para evitar erro de escopo) ---
  const totalItens = Object.values(carrinho).reduce((a, b) => a + b.qtd, 0);

  const [pedidoFinalizado, setPedidoFinalizado] = useState(false);
  const [vendedorRecuperado, setVendedorRecuperado] = useState<string | null>(
    vendedorId,
  );
  const [idsIniciaisNoCarrinho] = useState<string[]>(
    carrinhoInicial ? Object.keys(carrinhoInicial) : [],
  );

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor || 0);
  };

  // --- CÁLCULO DO SALDO FLEX EM TEMPO REAL ---
  const gastoTotalCarrinho = Object.values(carrinho).reduce((acc, item) => {
    const vDescUnitario =
      parseFloat(String(item.valorDesconto).replace(",", ".")) || 0;
    const quantidade = Number(item.qtd) || 0;
    return acc + vDescUnitario * quantidade;
  }, 0);

  const saldoRestante = (saldoFlex || 0) - gastoTotalCarrinho;
  // ------------------------------------------

  // --- INTERCEPTAÇÃO DO BOTÃO VOLTAR ---
  useEffect(() => {
    const interceptarSaida = navigation.addListener(
      "beforeRemove",
      (e: any) => {
        if (totalItens === 0) {
          return;
        }

        e.preventDefault();

        Alert.alert(
          "Abandonar Pedido?",
          "Você possui itens no carrinho. Se sair agora, os dados serão perdidos.",
          [
            { text: "Continuar Comprando", style: "cancel", onPress: () => {} },
            {
              text: "Sair e Perder Dados",
              style: "destructive",
              onPress: () => navigation.dispatch(e.data.action),
            },
          ],
        );
      },
    );

    return interceptarSaida;
  }, [navigation, totalItens]);

  useEffect(() => {
    const carregarProdutos = async () => {
      try {
        const response = await api.get(`/api/getprodutos?tabela=${tabela}`);
        setProdutos(response.data.produtos);
      } catch (error) {
        console.error("Erro ao carregar produtos:", error);
      } finally {
        setLoading(false);
      }
    };
    carregarProdutos();
  }, [tabela]);

  useEffect(() => {
    const buscarVendedorNoStorage = async () => {
      if (!vendedorRecuperado) {
        try {
          const vSalvo = await AsyncStorage.getItem("@vendedor_id");
          if (vSalvo) setVendedorRecuperado(vSalvo);
        } catch (e) {
          console.error("Erro ao buscar AsyncStorage:", e);
        }
      }
    };
    buscarVendedorNoStorage();
  }, [vendedorId]);

  const atualizarItemCarrinho = (
    codpro: string,
    campo: string,
    valor: string | number,
    itemOriginal: any,
  ) => {
    const prcTabela = Number(itemOriginal.preco) || 0;
    const limiteDescontoItem = prcTabela * 0.15;

    setCarrinho((prev) => {
      const itemAtual = prev[codpro] || {
        qtd: 0,
        precoTabela: prcTabela,
        precoVenda: prcTabela.toFixed(2).replace(".", ","),
        percDesconto: "0,00",
        valorDesconto: "0,00",
        valorFlex: "0,00",
      };

      let novoItem = { ...itemAtual };

      if (campo === "qtd") {
        const incremento = valor as number;
        const novaQtd = Math.max(0, itemAtual.qtd + incremento);

        if (incremento > 0) {
          const vDescUn =
            parseFloat(String(itemAtual.valorDesconto).replace(",", ".")) || 0;
          if (vDescUn > 0 && vDescUn > saldoRestante) {
            Alert.alert(
              "Saldo Insuficiente",
              "Você não tem saldo flex para mais unidades com este desconto.",
            );
            return prev;
          }
        }

        const nCarrinho = { ...prev };
        if (novaQtd === 0) delete nCarrinho[codpro];
        else {
          novoItem.qtd = novaQtd;
          nCarrinho[codpro] = novoItem;
        }
        return nCarrinho;
      }

      let textoLimpo = String(valor).replace(/[^0-9,]/g, "");
      const partes = textoLimpo.split(",");
      if (partes.length > 2)
        textoLimpo = partes[0] + "," + partes.slice(partes.length - 1);

      const vNum = parseFloat(textoLimpo.replace(",", ".")) || 0;
      let vlrDescPretendido = 0;

      if (campo === "precoVenda")
        vlrDescPretendido = Math.max(0, prcTabela - vNum);
      else if (campo === "percDesconto")
        vlrDescPretendido = (prcTabela * vNum) / 100;
      else if (campo === "valorDesconto") vlrDescPretendido = vNum;

      if (campo !== "precoVenda") {
        let valorFoiCorrigido = false;

        if (vlrDescPretendido > limiteDescontoItem + 0.001) {
          Alert.alert(
            "Limite Ajustado",
            "O desconto máximo de 15% foi aplicado.",
          );
          vlrDescPretendido = limiteDescontoItem;
          valorFoiCorrigido = true;
        }

        const gastoOutrosItens = Object.keys(prev)
          .filter((key) => key !== codpro)
          .reduce(
            (acc, key) =>
              acc +
              (parseFloat(String(prev[key].valorDesconto).replace(",", ".")) ||
                0) *
                prev[key].qtd,
            0,
          );

        const gastoTotalComEste =
          gastoOutrosItens + vlrDescPretendido * (itemAtual.qtd || 1);

        if (gastoTotalComEste > (saldoFlex || 0) + 0.001) {
          if (!valorFoiCorrigido)
            Alert.alert(
              "Saldo Ajustado",
              "Desconto reduzido ao limite do seu Flex.",
            );
          const saldoDisponivel = Math.max(
            0,
            (saldoFlex || 0) - gastoOutrosItens,
          );
          vlrDescPretendido = Math.min(
            saldoDisponivel / (itemAtual.qtd || 1),
            limiteDescontoItem,
          );
          valorFoiCorrigido = true;
        }

        const percFinal =
          prcTabela > 0
            ? ((vlrDescPretendido / prcTabela) * 100)
                .toFixed(2)
                .replace(".", ",")
            : "0,00";
        const valorFinal = vlrDescPretendido.toFixed(2).replace(".", ",");
        const precoFinal = (prcTabela - vlrDescPretendido)
          .toFixed(2)
          .replace(".", ",");

        if (campo === "percDesconto") {
          novoItem.percDesconto = valorFoiCorrigido ? percFinal : textoLimpo;
          novoItem.valorDesconto = valorFinal;
          novoItem.precoVenda = precoFinal;
        } else if (campo === "valorDesconto") {
          novoItem.valorDesconto = valorFoiCorrigido ? valorFinal : textoLimpo;
          novoItem.percDesconto = percFinal;
          novoItem.precoVenda = precoFinal;
        }
        novoItem.valorFlex = novoItem.valorDesconto;
      } else {
        novoItem.precoVenda = textoLimpo;
        if (vNum >= prcTabela) {
          novoItem.valorDesconto = "0,00";
          novoItem.percDesconto = "0,00";
          novoItem.valorFlex = "0,00";
        } else {
          novoItem.valorDesconto = vlrDescPretendido
            .toFixed(2)
            .replace(".", ",");
          novoItem.percDesconto =
            prcTabela > 0
              ? ((vlrDescPretendido / prcTabela) * 100)
                  .toFixed(2)
                  .replace(".", ",")
              : "0,00";
          novoItem.valorFlex = novoItem.valorDesconto;
        }
      }

      return { ...prev, [codpro]: novoItem };
    });
  };

  const validarPrecoVendaOnBlur = (codpro: string, itemOriginal: any) => {
    const prcTabela = Number(itemOriginal.preco) || 0;
    setCarrinho((prev) => {
      const item = prev[codpro];
      if (!item) return prev;
      const vNum = parseFloat(String(item.precoVenda).replace(",", ".")) || 0;

      return {
        ...prev,
        [codpro]: { ...item, precoVenda: vNum.toFixed(2).replace(".", ",") },
      };
    });
  };

  const produtosOrdenados = useMemo(() => {
    const filtrados = produtos.filter((p: any) => {
      const t = searchQuery.toLowerCase();
      return (
        p.desc.toLowerCase().includes(t) || p.codpro.toLowerCase().includes(t)
      );
    });
    return filtrados.sort((a, b) => {
      const aEstavaNoCarrinho = idsIniciaisNoCarrinho.includes(a.codpro);
      const bEstavaNoCarrinho = idsIniciaisNoCarrinho.includes(b.codpro);
      if (aEstavaNoCarrinho && !bEstavaNoCarrinho) return -1;
      if (!aEstavaNoCarrinho && bEstavaNoCarrinho) return 1;
      return a.desc.localeCompare(b.desc);
    });
  }, [produtos, searchQuery, idsIniciaisNoCarrinho]);

  if (loading)
    return (
      <ActivityIndicator style={{ flex: 1 }} size="large" color="#005492" />
    );

  return (
    <View style={styles.container}>
      <Surface style={styles.headerInfo}>
        <View style={styles.rowHeader}>
          <View>
            <Text style={styles.tabelaTexto}>
              Tabela: <Text style={{ fontWeight: "bold" }}>{tabela}</Text>
            </Text>
            <Text style={styles.saldoFlexLabel}>
              Saldo Flex:{" "}
              <Text
                style={[
                  styles.saldoFlexValor,
                  { color: saldoRestante >= 0 ? "#2e7d32" : "#d32f2f" },
                ]}
              >
                {formatarMoeda(saldoRestante)}
              </Text>
            </Text>
          </View>
          <Badge visible={totalItens > 0} size={25} style={styles.badge}>
            {totalItens}
          </Badge>
        </View>
      </Surface>

      <Searchbar
        placeholder="Buscar produto..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      <FlatList
        data={produtosOrdenados}
        keyExtractor={(item: any) => item.codpro}
        renderItem={({ item, index }) => {
          const precoBase = Number(item.preco) || 0;
          const dItem = carrinho[item.codpro] || { qtd: 0 };
          const isAdicionado = dItem.qtd > 0;
          const mostrarDivisor =
            index > 0 &&
            !idsIniciaisNoCarrinho.includes(item.codpro) &&
            idsIniciaisNoCarrinho.includes(produtosOrdenados[index - 1].codpro);
          const vUnitario =
            parseFloat(
              String(dItem.precoVenda || precoBase).replace(",", "."),
            ) || precoBase;
          const vTotalCard = vUnitario * (dItem.qtd > 0 ? dItem.qtd : 1);

          return (
            <View>
              {mostrarDivisor && (
                <View style={styles.divisorSessao}>
                  <Divider style={styles.linhaDivisora} />
                  <Text style={styles.textoDivisor}>DEMAIS PRODUTOS</Text>
                  <Divider style={styles.linhaDivisora} />
                </View>
              )}
              <Surface
                style={[
                  styles.cardProduto,
                  isAdicionado && styles.cardAdicionado,
                ]}
              >
                <List.Accordion
                  title={item.desc}
                  titleStyle={styles.descTitle}
                  titleNumberOfLines={2}
                  description={
                    <Text style={{ fontSize: 12, color: "#666" }}>
                      {`Cód: ${item.codpro}  |  `}
                      <Text
                        style={{
                          fontWeight: "bold",
                          color: item.saldo > 0 ? "#005492" : "#d32f2f",
                        }}
                      >{`Estoque: ${item.saldo}`}</Text>
                    </Text>
                  }
                  left={(p) => (
                    <List.Icon
                      {...p}
                      icon="package-variant"
                      color={isAdicionado ? "#2e7d32" : "#005492"}
                    />
                  )}
                >
                  <View style={styles.expandido}>
                    <View style={styles.containerCampos}>
                      <Text style={styles.labelTotalCard}>
                        Total do Item: {formatarMoeda(vTotalCard)}
                      </Text>
                      <TextInput
                        label="Preço Tabela"
                        value={formatarMoeda(precoBase)}
                        mode="outlined"
                        disabled
                        style={styles.inputFull}
                      />

                      <View style={styles.rowInputs}>
                        <TextInput
                          label="Preço Venda"
                          value={
                            dItem.precoVenda ||
                            precoBase.toFixed(2).replace(".", ",")
                          }
                          mode="outlined"
                          keyboardType="decimal-pad"
                          selectTextOnFocus={true}
                          onChangeText={(v) =>
                            atualizarItemCarrinho(
                              item.codpro,
                              "precoVenda",
                              v,
                              item,
                            )
                          }
                          onBlur={() =>
                            validarPrecoVendaOnBlur(item.codpro, item)
                          }
                          style={styles.inputHalf}
                        />
                        <TextInput
                          label="% Desconto"
                          value={dItem.percDesconto || "0,00"}
                          mode="outlined"
                          keyboardType="decimal-pad"
                          selectTextOnFocus={true}
                          onChangeText={(v) =>
                            atualizarItemCarrinho(
                              item.codpro,
                              "percDesconto",
                              v,
                              item,
                            )
                          }
                          style={styles.inputHalf}
                        />
                      </View>

                      <View style={styles.rowInputs}>
                        <TextInput
                          label="Valor Desconto"
                          value={dItem.valorDesconto || "0,00"}
                          mode="outlined"
                          keyboardType="decimal-pad"
                          selectTextOnFocus={true}
                          onChangeText={(v) =>
                            atualizarItemCarrinho(
                              item.codpro,
                              "valorDesconto",
                              v,
                              item,
                            )
                          }
                          style={styles.inputHalf}
                        />
                        <TextInput
                          label="Valor Flex"
                          value={dItem.valorFlex || "0,00"}
                          mode="outlined"
                          editable={false}
                          style={[
                            styles.inputHalf,
                            { backgroundColor: "#f5f5f5" },
                          ]}
                        />
                      </View>

                      <View style={styles.controles}>
                        <IconButton
                          icon="minus-circle-outline"
                          size={35}
                          iconColor="#d32f2f"
                          onPress={() =>
                            atualizarItemCarrinho(item.codpro, "qtd", -1, item)
                          }
                          disabled={!isAdicionado}
                        />
                        <Text style={styles.qtdText}>{dItem.qtd || 0}</Text>
                        <IconButton
                          icon="plus-circle"
                          size={35}
                          iconColor="#2e7d32"
                          onPress={() =>
                            atualizarItemCarrinho(item.codpro, "qtd", 1, item)
                          }
                        />
                      </View>
                    </View>
                  </View>
                </List.Accordion>
              </Surface>
            </View>
          );
        }}
      />

      {totalItens > 0 && (
        <Surface style={styles.footer}>
          <Button
            mode="contained"
            style={styles.btnFinalizar}
            onPress={() => {
              const idParaEnviar = vendedorRecuperado || vendedorId;
              navigation.navigate("RevisaoPedido", {
                carrinho,
                cliente,
                loja,
                tabela,
                vendedorId: idParaEnviar,
                pedidoIdEdicao,
                produtosOriginais: produtos,
                dadosPedidoSalvo: route.params?.dadosPedidoSalvo,
                saldoFlex,
              });
            }}
          >
            Revisar Pedido ({totalItens} itens)
          </Button>
        </Surface>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f2f5" },
  headerInfo: { padding: 12, backgroundColor: "#fff", elevation: 2 },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tabelaTexto: { fontSize: 13, color: "#666" },
  saldoFlexLabel: { fontSize: 13, color: "#666", marginTop: 2 },
  saldoFlexValor: { fontWeight: "bold" },
  badge: { backgroundColor: "#005492" },
  searchBar: { margin: 10, borderRadius: 10, backgroundColor: "#fff" },
  divisorSessao: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 15,
    marginHorizontal: 15,
  },
  linhaDivisora: { flex: 1, height: 1, backgroundColor: "#ccc" },
  textoDivisor: {
    marginHorizontal: 10,
    fontSize: 10,
    fontWeight: "bold",
    color: "#888",
  },
  cardProduto: {
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 12,
    elevation: 3,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  cardAdicionado: { borderLeftWidth: 6, borderLeftColor: "#2e7d32" },
  descTitle: { fontSize: 15, fontWeight: "bold", color: "#333" },
  expandido: {
    backgroundColor: "#f9f9f9",
    marginLeft: -40,
    width: "115%",
    paddingVertical: 15,
  },
  containerCampos: {
    paddingHorizontal: 25,
    width: "100%",
    alignItems: "center",
  },
  labelTotalCard: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2e7d32",
    marginBottom: 15,
    textAlign: "center",
  },
  inputFull: {
    width: "100%",
    marginBottom: 10,
    height: 48,
    backgroundColor: "#fff",
  },
  rowInputs: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 10,
  },
  inputHalf: { width: "48%", height: 48, backgroundColor: "#fff" },
  controles: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  qtdText: { fontSize: 24, fontWeight: "bold", marginHorizontal: 25 },
  footer: { padding: 15, backgroundColor: "#fff" },
  btnFinalizar: { backgroundColor: "#005492" },
});

export default SelecaoProdutosScreen;
