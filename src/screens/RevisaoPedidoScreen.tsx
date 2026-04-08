import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
  TextInput,
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
  console.log("DEBUG 3 - Chegou na Revisão:", route.params?.atendimento);
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
    atendimento,
  } = route.params;

  // LOG 1: Verificar se a tela recebeu o atendimento do produto/tabela
  console.log("DEBUG - Atendimento recebido na Revisão:", atendimento);

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

  // ✅ NOVOS ESTADOS PARA OBSERVAÇÃO NF
  const [modalObservacaoVisivel, setModalObservacaoVisivel] =
    useState<boolean>(false);
  const [modalDigitacaoVisivel, setModalDigitacaoVisivel] =
    useState<boolean>(false);
  const [observacaoNF, setObservacaoNF] = useState<string>(
    dadosPedidoSalvo?.observacaoNF || "",
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

  // ✅ FUNÇÃO PARA PERGUNTAR SOBRE OBSERVAÇÃO NF
  const perguntarObservacaoNF = () => {
    setModalObservacaoVisivel(true);
  };

  // ✅ FUNÇÃO PARA ABRIR CAMPO DE DIGITAÇÃO
  const abrirCampoObservacao = () => {
    setModalObservacaoVisivel(false);
    setModalDigitacaoVisivel(true);
  };

  // ✅ FUNÇÃO PARA SALVAR OBSERVAÇÃO E FINALIZAR
  const salvarObservacaoEFinalizar = () => {
    setModalDigitacaoVisivel(false);
    finalizarPedido();
  };

  // ✅ FUNÇÃO PARA PULAR OBSERVAÇÃO E FINALIZAR
  const pularObservacaoEFinalizar = () => {
    setModalObservacaoVisivel(false);
    finalizarPedido();
  };

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
            // --- 1. CAPTURA A HORA DE AGORA (FIM DO ATENDIMENTO) ---
            const agoraFim = new Date();
            const dataFim = agoraFim
              .toISOString()
              .split("T")[0]
              .replace(/-/g, "");
            const horaFim = agoraFim.toLocaleTimeString("pt-BR", {
              hour12: false,
            });

            // Buscamos a descrição da condição selecionada para o PDF
            const descCondicao =
              condicoes?.find((c: any) => c.id === condicaoSel)?.descricao ||
              condicaoSel;

            const novoPedido = {
              id: pedidoIdEdicao || Date.now().toString(),
              dataCriacao:
                dadosPedidoSalvo?.dataCriacao || new Date().toISOString(),
              data: new Date().toLocaleDateString("pt-BR"),

              // --- 2. ADICIONE OS CAMPOS PARA A ZF4 AQUI ---
              dataini: atendimento?.dataInic || "", // Veio da tela DetalhesCliente
              horaini: atendimento?.horaInic || "", // Veio da tela DetalhesCliente
              datafim: dataFim, // Gerado agora no clique
              horafim: horaFim, // Gerado agora no clique
              tipoAten: atendimento?.tipo || "", // Veio da tela DetalhesCliente

              // --- DADOS DO VENDEDOR ---
              vendedor: vendedorId,
              vendedorNome:
                route.params.vendedorNome || "Vendedor não informado",

              // --- DADOS DO CLIENTE (Objeto completo vindo da DetalhesCliente) ---
              cliente: cliente, // Aqui já terá nome, cnpj, endereco, bairro, etc.
              loja,

              // --- TABELA DE PREÇO ---
              tabela,
              tabelaDesc: route.params.tabelaDesc || "Tabela não informada",

              // --- CONDIÇÃO DE PAGAMENTO ---
              condicaoPagamento: condicaoSel,
              condicaoDesc: descCondicao,
              formaPagto,
              valorTotal: tratarValor(valorTotal),
              saldoFlex: saldoFlex,
              carrinho: carrinho, // Mantemos para conferência de quantidades no PDF

              // ✅ ADICIONE A OBSERVAÇÃO NF AQUI
              observacaoNF: observacaoNF || "", // Campo para sincronizar com Protheus

              itens: itensRevisao.map((item: any) => {
                const d = carrinho[item.codpro];
                return {
                  codpro: item.codpro,
                  desc: item.desc,
                  qtd: Number(d.qtd),
                  precoVenda: Number(tratarValor(d.precoVenda).toFixed(2)),
                  precoTabela: Number(tratarValor(d.precoTabela).toFixed(2)),
                  valorFlex: Number(
                    tratarValor(d.valorFlex || d.valorDesconto).toFixed(2),
                  ),
                  percDesconto: d.percDesconto,
                  valorDesconto: d.valorDesconto,
                };
              }),
              status: "pendente",
            };

            // LOG 2: Verificar o objeto que será salvo no celular
            console.log(
              "DEBUG - Objeto Novo Pedido pronto para salvar:",
              novoPedido,
            );

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
                          params: { vendedorId: vendedorId },
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

              {/* ✅ EXIBIR OBSERVAÇÃO NF SE HOUVER */}
              {observacaoNF && (
                <View style={styles.observacaoBox}>
                  <Text style={styles.label}>Observação para NF</Text>
                  <Surface style={styles.observacaoDisplay}>
                    <Text style={styles.observacaoText}>{observacaoNF}</Text>
                  </Surface>
                </View>
              )}
            </View>

            <Button
              mode="contained"
              onPress={perguntarObservacaoNF}
              style={styles.btnFinalizar}
            >
              GRAVAR PEDIDO
            </Button>
          </Surface>
        </View>
      </ScrollView>

      <Portal>
        {/* ✅ MODAL PERGUNTANDO SOBRE OBSERVAÇÃO NF */}
        <Modal
          visible={modalObservacaoVisivel}
          onDismiss={() => setModalObservacaoVisivel(false)}
          contentContainerStyle={styles.modalObservacaoStyle}
        >
          <Title style={{ textAlign: "center", marginBottom: 20 }}>
            Observação para Nota Fiscal
          </Title>
          <Text style={{ textAlign: "center", marginBottom: 20, fontSize: 16 }}>
            Deseja incluir uma observação para a Nota Fiscal?
          </Text>
          <View style={styles.modalButtonsContainer}>
            <Button
              mode="outlined"
              onPress={pularObservacaoEFinalizar}
              style={styles.modalButton}
            >
              Não
            </Button>
            <Button
              mode="contained"
              onPress={abrirCampoObservacao}
              style={styles.modalButton}
              buttonColor="#005492"
            >
              Sim
            </Button>
          </View>
        </Modal>

        {/* ✅ MODAL PARA DIGITAÇÃO DA OBSERVAÇÃO */}
        <Modal
          visible={modalDigitacaoVisivel}
          onDismiss={() => setModalDigitacaoVisivel(false)}
          contentContainerStyle={styles.modalDigitacaoStyle}
        >
          <Title style={{ textAlign: "center", marginBottom: 20 }}>
            Digite a Observação
          </Title>
          <TextInput
            style={styles.textInputObservacao}
            placeholder="Digite a observação para a Nota Fiscal..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={5}
            value={observacaoNF}
            onChangeText={setObservacaoNF}
            textAlignVertical="top"
          />
          <View style={styles.modalButtonsContainer}>
            <Button
              mode="outlined"
              onPress={() => setModalDigitacaoVisivel(false)}
              style={styles.modalButton}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={salvarObservacaoEFinalizar}
              style={styles.modalButton}
              buttonColor="#2E7D32"
            >
              Salvar
            </Button>
          </View>
        </Modal>

        {/* MODAL CONDIÇÕES DE PAGAMENTO */}
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

        {/* MODAL FORMA DE PAGAMENTO */}
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
  observacaoBox: { marginTop: 20 },
  observacaoDisplay: {
    borderRadius: 8,
    backgroundColor: "#F0F8FF",
    borderWidth: 1,
    borderColor: "#005492",
    padding: 12,
  },
  observacaoText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
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
  // ✅ NOVOS ESTILOS PARA MODAIS DE OBSERVAÇÃO
  modalObservacaoStyle: {
    backgroundColor: "white",
    padding: 25,
    margin: 30,
    borderRadius: 12,
    elevation: 5,
  },
  modalDigitacaoStyle: {
    backgroundColor: "white",
    padding: 25,
    margin: 20,
    borderRadius: 12,
    elevation: 5,
  },
  textInputObservacao: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#F8F9FA",
  },
  modalButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  modalButton: {
    flex: 1,
  },
});

export default RevisaoPedidoScreen;
