import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  List,
  Divider,
  Headline,
  Title,
  Portal,
  Modal,
  Searchbar,
} from "react-native-paper";
import { CommonActions } from "@react-navigation/native";
import api from "../api/api";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// --- INTERFACES ---
interface ItemCarrinho {
  qtd: number;
  precoTabela: number;
  precoVenda: string | number;
  percDesconto: string;
  valorDesconto: string;
  valorFlex?: string;
}

interface Produto {
  codpro: string;
  desc: string;
  preco: number;
}

interface CondicaoPagto {
  id: string;
  descricao: string;
}

const RevisaoPedidoScreen = ({ route, navigation }: any) => {
  const {
    carrinho,
    cliente,
    loja,
    tabela,
    vendedorId,
    pedidoIdEdicao,
    produtosOriginais,
    dadosPedidoSalvo,
    saldoFlex,
  } = route.params;

  const idVendedorEfetivo =
    vendedorId || cliente?.vendedor || dadosPedidoSalvo?.vendedor;

  const [loading, setLoading] = useState<boolean>(true);
  const [condicoes, setCondicoes] = useState<CondicaoPagto[]>([]);
  const [condicaoSel, setCondicaoSel] = useState<string>(
    dadosPedidoSalvo?.condicaoPagamento || "",
  );
  const [formaPagto, setFormaPagto] = useState<string>(
    dadosPedidoSalvo?.formaPagto || "",
  );

  const [modalFormaVisivel, setModalFormaVisivel] = useState<boolean>(false);
  const [modalVisivel, setModalVisivel] = useState<boolean>(false);
  const [busca, setBusca] = useState<string>("");

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor || 0);
  };

  const itensRevisao = produtosOriginais.filter(
    (p: Produto) => carrinho[p.codpro] && carrinho[p.codpro].qtd > 0,
  );

  const valorTotal = itensRevisao.reduce((acc: number, p: Produto) => {
    const d: ItemCarrinho = carrinho[p.codpro];
    const pVenda =
      typeof d.precoVenda === "string"
        ? parseFloat(d.precoVenda.replace(",", "."))
        : d.precoVenda;
    return acc + (pVenda || p.preco) * d.qtd;
  }, 0);

  const condicoesFiltradas = condicoes.filter(
    (c) =>
      c.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      c.id.includes(busca),
  );

  const gerarPDFCotacao = async () => {
    // Usamos a sua função de formatar moeda já existente no arquivo
    const dataAtual = new Date().toLocaleDateString("pt-BR");

    // Montando as linhas da tabela usando 'itensRevisao' e 'carrinho'
    const itensHtml = itensRevisao
      .map((item: Produto, index: number) => {
        const d = carrinho[item.codpro];

        // Lógica de preço que você já usa no seu render (tratando string ou number)
        const pV =
          typeof d.precoVenda === "string"
            ? parseFloat(d.precoVenda.replace(",", "."))
            : d.precoVenda;

        const precoFinal = pV || item.preco;
        const subtotal = precoFinal * d.qtd;

        return `
      <tr>
        <td style="text-align: center;">${String(index + 1).padStart(2, "0")}</td>
        <td>${item.desc}</td>
        <td style="text-align: center;">${d.qtd}</td>
        <td style="text-align: right;">${formatarMoeda(precoFinal)}</td>
        <td style="text-align: right;">${formatarMoeda(subtotal)}</td>
      </tr>
    `;
      })
      .join("");

    const htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: 'Helvetica'; padding: 20px; color: #333; }
          .header { text-align: center; border-bottom: 2px solid #005492; padding-bottom: 10px; }
          .title { font-size: 18px; font-weight: bold; color: #005492; }
          .info-section { margin-top: 20px; font-size: 12px; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
          th { background-color: #005492; color: white; padding: 8px; text-align: left; }
          td { border: 1px solid #ddd; padding: 8px; }
          .total-box { margin-top: 20px; text-align: right; font-size: 14px; font-weight: bold; color: #2E7D32; }
          .footer { margin-top: 30px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Automação da Força de Vendas (SFA)</div>
          <div style="font-size: 14px;">Cotação / Orçamento</div>
        </div>
        
        <div class="info-section">
          <p><strong>Data:</strong> ${dataAtual}</p>
          <p><strong>Cliente:</strong> ${cliente?.NOME || cliente?.nome || "Não informado"}</p>
          <p><strong>Vendedor:</strong> ${vendedorId || ""}</p>
          <p><strong>Condição:</strong> ${condicaoSel || "A combinar"}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">Item</th>
              <th>Produto</th>
              <th style="width: 40px; text-align: center;">Qtd</th>
              <th style="text-align: right;">Preço Un.</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itensHtml}
          </tbody>
        </table>

        <div class="total-box">
          VALOR TOTAL DO PEDIDO: ${formatarMoeda(valorTotal)}
        </div>

        <div class="footer">
          ESTE DOCUMENTO NÃO TEM VALIDADE FISCAL
        </div>
      </body>
    </html>
  `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
      });
    } catch (error) {
      Alert.alert("Erro", "Não foi possível gerar o PDF da cotação.");
    }
  };

  useEffect(() => {
    const carregarCondicoes = async () => {
      if (!idVendedorEfetivo) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await api.get(
          `/api/getcondpagtoVendedor?vendedor=${idVendedorEfetivo}`,
        );
        if (response.data && response.data.condicoes) {
          setCondicoes(response.data.condicoes);
        }
      } catch (error) {
        console.error("Erro API Condições:", error);
      } finally {
        setLoading(false);
      }
    };

    carregarCondicoes();
  }, [idVendedorEfetivo]);

  const finalizarPedido = async () => {
    if (!condicaoSel || !formaPagto) {
      return Alert.alert(
        "Atenção",
        "Selecione a condição e a forma de pagamento.",
      );
    }

    const tratarValor = (valor: any) => {
      if (typeof valor === "number") return valor;
      const str = String(valor || "0");
      const limpo = str.replace(/\./g, "").replace(",", ".");
      return parseFloat(limpo) || 0;
    };

    Alert.alert("Salvar Pedido", `Total: ${formatarMoeda(valorTotal)}`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        onPress: async () => {
          try {
            const novoPedido = {
              id: pedidoIdEdicao || Date.now().toString(),
              dataCriacao:
                dadosPedidoSalvo?.dataCriacao || new Date().toISOString(),
              vendedor: idVendedorEfetivo,
              cliente: cliente,
              loja,
              tabela,
              condicaoPagamento: condicaoSel,
              formaPagto,
              valorTotal: tratarValor(valorTotal),
              saldoFlex: saldoFlex,
              itens: itensRevisao.map((item: any) => {
                const d = carrinho[item.codpro];
                const nPrecoVenda = tratarValor(d.precoVenda);
                const nValorFlex = tratarValor(d.valorFlex || d.valorDesconto);
                const nPrecoTabela = tratarValor(d.precoTabela);

                return {
                  codpro: item.codpro,
                  desc: item.desc,
                  qtd: Number(d.qtd),
                  precoVenda: Number(nPrecoVenda.toFixed(2)),
                  precoTabela: Number(nPrecoTabela.toFixed(2)),
                  valorFlex: Number(nValorFlex.toFixed(2)),
                  percDesconto: d.percDesconto,
                  valorDesconto: d.valorDesconto,
                };
              }),
              status: "pendente",
            };

            const salvos = await AsyncStorage.getItem("@pedidos_offline");
            let lista = salvos ? JSON.parse(salvos) : [];

            if (pedidoIdEdicao) {
              lista = lista.map((p: any) =>
                p.id === pedidoIdEdicao ? novoPedido : p,
              );
            } else {
              lista.push(novoPedido);
            }

            await AsyncStorage.setItem(
              "@pedidos_offline",
              JSON.stringify(lista),
            );

            // --- MELHOR PRÁTICA: RESET DE NAVEGAÇÃO APÓS SUCESSO ---
            // Isso limpa a pilha e evita que o 'beforeRemove' da tela anterior
            // veja dados sujos.
            Alert.alert("Sucesso", "Pedido salvo offline!", [
              {
                text: "OK",
                onPress: () => {
                  navigation.dispatch(
                    CommonActions.reset({
                      index: 0,
                      routes: [
                        {
                          name: "Clientes",
                          params: { vendedorId: vendedorId }, // O params tem que ser aqui dentro!
                        },
                      ],
                    }),
                  );
                },
              },
            ]);
          } catch (e) {
            Alert.alert("Erro", "Não foi possível gravar o pedido.");
          }
        },
      },
    ]);
  };

  if (loading)
    return (
      <ActivityIndicator style={{ flex: 1 }} size="large" color="#005492" />
    );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#005492" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Surface style={styles.headerResumo}>
          <Text style={styles.labelTotalHeader}>Total do Pedido</Text>
          <Headline style={styles.valorTotalText}>
            {formatarMoeda(valorTotal)}
          </Headline>
        </Surface>

        <View style={styles.contentWrapper}>
          <Surface style={styles.mainCard}>
            <List.Section>
              <List.Subheader style={styles.subheader}>Produtos</List.Subheader>
              {itensRevisao.map((item: Produto) => {
                const d = carrinho[item.codpro];
                const pV =
                  typeof d.precoVenda === "string"
                    ? parseFloat(d.precoVenda.replace(",", "."))
                    : d.precoVenda;
                return (
                  <View key={item.codpro}>
                    <List.Item
                      title={item.desc}
                      description={`${d.qtd} un x ${formatarMoeda(pV || item.preco)}`}
                      right={() => (
                        <Text style={styles.itemTotal}>
                          {formatarMoeda((pV || item.preco) * d.qtd)}
                        </Text>
                      )}
                    />
                    <Divider />
                  </View>
                );
              })}
            </List.Section>

            <View style={styles.pagamentoSection}>
              <Text style={styles.label}>Condição de Pagamento</Text>
              <Surface style={styles.pickerBox}>
                <List.Item
                  title={
                    condicaoSel
                      ? condicoes.find((c) => c.id === condicaoSel)
                          ?.descricao || condicaoSel
                      : "Selecione..."
                  }
                  onPress={() => setModalVisivel(true)}
                  left={(p) => (
                    <List.Icon {...p} icon="calendar-clock" color="#005492" />
                  )}
                />
              </Surface>

              <Text style={[styles.label, { marginTop: 15 }]}>
                Forma de Recebimento
              </Text>
              <Surface style={styles.pickerBox}>
                <List.Item
                  title={formaPagto || "Selecione..."}
                  onPress={() => setModalFormaVisivel(true)}
                  left={(p) => (
                    <List.Icon {...p} icon="wallet" color="#005492" />
                  )}
                />
              </Surface>
            </View>
            <Button
              mode="outlined"
              icon="file-pdf-box"
              onPress={gerarPDFCotacao} // Função que criamos antes
              style={styles.btnPdf}
              textColor="#005492"
            >
              GERAR COTAÇÃO (PDF)
            </Button>
            <Button
              mode="contained"
              onPress={finalizarPedido}
              style={styles.btnFinalizar}
            >
              GRAVAR PEDIDO
            </Button>
          </Surface>
        </View>
      </ScrollView>

      <Portal>
        <Modal
          visible={modalVisivel}
          onDismiss={() => setModalVisivel(false)}
          contentContainerStyle={styles.modalStyle}
        >
          <Title style={{ textAlign: "center" }}>Condições</Title>
          <Searchbar
            placeholder="Buscar..."
            onChangeText={setBusca}
            value={busca}
            style={{ marginVertical: 10 }}
          />
          <ScrollView style={{ maxHeight: 300 }}>
            {condicoesFiltradas.map((item) => (
              <List.Item
                key={item.id}
                title={`${item.id} - ${item.descricao}`}
                onPress={() => {
                  setCondicaoSel(item.id);
                  if (item.descricao.toUpperCase().includes("PIX"))
                    setFormaPagto("PAGTO INSTANT. (PIX)");
                  setModalVisivel(false);
                }}
              />
            ))}
          </ScrollView>
        </Modal>

        <Modal
          visible={modalFormaVisivel}
          onDismiss={() => setModalFormaVisivel(false)}
          contentContainerStyle={styles.modalFormaStyle}
        >
          <Title style={{ textAlign: "center" }}>Forma de Pagamento</Title>
          <List.Item
            title="BOLETO BANCÁRIO"
            onPress={() => {
              setFormaPagto("BOLETO BANCÁRIO");
              setModalFormaVisivel(false);
            }}
          />
          <Divider />
          <List.Item
            title="PAGTO INSTANT. (PIX)"
            onPress={() => {
              setFormaPagto("PAGTO INSTANT. (PIX)");
              setModalFormaVisivel(false);
            }}
          />
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F2F5" },
  headerResumo: {
    paddingTop: 40,
    paddingBottom: 40,
    backgroundColor: "#005492",
    alignItems: "center",
  },
  labelTotalHeader: { color: "#fff", opacity: 0.8 },
  valorTotalText: { fontSize: 32, fontWeight: "bold", color: "#fff" },
  contentWrapper: { marginTop: -20, paddingHorizontal: 15 },
  mainCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingBottom: 15,
    elevation: 3,
  },
  subheader: { fontWeight: "bold", color: "#005492" },
  itemTotal: {
    fontWeight: "bold",
    color: "#2E7D32",
    alignSelf: "center",
    marginRight: 15,
  },
  pagamentoSection: { padding: 15 },
  label: { fontSize: 14, fontWeight: "bold", color: "#666", marginBottom: 5 },
  pickerBox: {
    borderRadius: 8,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#DDD",
  },
  btnFinalizar: { margin: 15, backgroundColor: "#2E7D32", paddingVertical: 5 },
  modalStyle: {
    backgroundColor: "white",
    padding: 20,
    margin: 20,
    borderRadius: 10,
  },
  modalFormaStyle: {
    backgroundColor: "white",
    padding: 20,
    margin: 40,
    borderRadius: 10,
  },
  btnPdf: {
    marginHorizontal: 15,
    marginTop: 10,
    borderColor: "#005492",
    borderWidth: 1.5,
  },
});

export default RevisaoPedidoScreen;
