import React, { useState, useEffect, useRef } from "react";
// @ts-ignore
import { db, auth } from "./firebase";
import {
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  increment,
  collection,
  getDocs,
  arrayUnion,
  deleteDoc,
  getDoc,
  arrayRemove,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// Colores deportivos predeterminados para ofrecer en la interfaz
const PALETA_COLORES = [
  { nombre: "Verde Éxito", hex: "#15803d" },
  { nombre: "Rojo Alerta", hex: "#b91c1c" },
  { nombre: "Azul Táctico", hex: "#1d4ed8" },
  { nombre: "Amarillo Alerta", hex: "#b45309" },
  { nombre: "Negro", hex: "#1f2937" },
  { nombre: "Morado Especial", hex: "#6b21a8" },
  { nombre: "Gris Neutro", hex: "#4b5563" },
];

// Estructura base por si el profe no configuró nada todavía
const BOTONES_POR_DEFECTO = [
  {
    id: "goles_menu",
    nombre: "⚽ ¡GOL!",
    color: "#d97706",
    orden: 0,
    esGol: true,
  },
  {
    id: "ingresos_area_favor",
    nombre: "Área Favor",
    color: "#15803d",
    orden: 1,
  },
  {
    id: "ingresos_area_contra",
    nombre: "Área Contra",
    color: "#b91c1c",
    orden: 2,
  },
  { id: "tiros_favor", nombre: "Tiro Favor", color: "#166534", orden: 3 },
  { id: "tiros_contra", nombre: "Tiro Contra", color: "#991b1b", orden: 4 },
  { id: "cortos_favor", nombre: "Corto Favor", color: "#059669", orden: 5 },
  { id: "cortos_contra", nombre: "Corto Contra", color: "#e11d48", orden: 6 },
];

const CATEGORIAS_SISTEMA = [
  { id: "sub14", nombre: "Sub 14 Damas" },
  { id: "sub16", nombre: "Sub 16 Damas" },
  { id: "sub18", nombre: "Sub 18 Damas" },
  { id: "primera", nombre: "Primera División" },
];

const formatearTiempo = (totalSegundos: number) => {
  const mins = Math.floor(totalSegundos / 60);
  const secs = totalSegundos % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

export default function App() {
  // --- ESTADOS DE AUTENTICACIÓN ---
  const [usuario, setUsuario] = useState<any>(null);
  const [perfilUsuario, setPerfilUsuario] = useState<any>(null);
  const [cargandoAuth, setCargandoAuth] = useState<boolean>(true);

  const [identificadorProfe, setIdentificadorProfe] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errorAuth, setErrorAuth] = useState<string>("");

  // --- ESTADOS DE GESTIÓN DE EQUIPOS Y USUARIOS ---
  const [listaEquipos, setListaEquipos] = useState<any[]>([]);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<string>("");
  const [jugadorasDelEquipo, setJugadorasDelEquipo] = useState<string[]>([]);
  const [botonesDinamicos, setBotonesDinamicos] = useState<any[]>([]);
  const [listaTodosLosProfes, setListaTodosLosProfes] = useState<any[]>([]);

  const [modoAdmin, setModoAdmin] = useState<boolean>(false);
  const [nuevoNombreEquipo, setNuevoNombreEquipo] = useState<string>("");
  const [nuevasJugadorasTexto, setNuevasJugadorasTexto] = useState<string>("");

  const [jugadoraEditando, setJugadoraEditando] = useState<string | null>(null);
  const [nuevoNombreEditado, setNuevoNombreEditado] = useState<string>("");

  const [nuevoBtnNombre, setNuevoBtnNombre] = useState<string>("");
  const [nuevoBtnColor, setNuevoBtnColor] = useState<string>("#4b5563");

  const [mostrarSubmenuGol, setMostrarSubmenuGol] = useState<boolean>(false);

  // Estados de Configuración del Partido
  const [partidoIniciado, setPartidoIniciado] = useState<boolean>(false);
  const [vista, setVista] = useState<string>("telefono");
  const [rival, setRival] = useState<string>("");
  const [cancha, setCancha] = useState<string>("");
  const [fecha, setFecha] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [titulares, setTitulares] = useState<string[]>([]);
  const [suplentes, setSuplentes] = useState<string[]>([]);

  // Estados del Juego
  const [cuartoActual, setCuartoActual] = useState<string>("1Q");
  const [segundos, setSegundos] = useState<number>(0);
  const [corriendo, setCorriendo] = useState<boolean>(false);
  const idIntervalo = useRef<any>(null);
  const [idPartido, setIdPartido] = useState<string>("");

  const [estadisticas, setEstadisticas] = useState<any>({
    "1Q": {},
    "2Q": {},
    "3Q": {},
    "4Q": {},
  });

  // --- HISTORIAL ---
  const [listaPartidosViejos, setListaPartidosViejos] = useState<any[]>([]);
  const [partidoHistorialSeleccionado, setPartidoHistorialSeleccionado] =
    useState<any>(null);
  const [vistaHistorial, setVistaHistorial] = useState<boolean>(false);

  // --- TIMER ---
  useEffect(() => {
    if (corriendo) {
      idIntervalo.current = setInterval(() => {
        setSegundos((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(idIntervalo.current);
    }
    return () => clearInterval(idIntervalo.current);
  }, [corriendo]);

  // --- LÓGICA DE EVENTOS EN TIEMPO REAL CON FIREBASE ---
  useEffect(() => {
    if (partidoIniciado && idPartido) {
      const desuscribirPartido = onSnapshot(
        doc(db, "partidos_club", idPartido),
        (docSnap) => {
          if (docSnap.exists()) {
            const datos = docSnap.data();
            if (datos.estadisticas) {
              setEstadisticas(datos.estadisticas);
            }
          }
        }
      );
      return () => desuscribirPartido();
    }
  }, [partidoIniciado, idPartido]);

  // --- CONTROLADOR DE SESIÓN ---
  useEffect(() => {
    const desuscribirAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuario(user);
        const docSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (docSnap.exists()) {
          setPerfilUsuario(docSnap.data());
        } else {
          const esCoord = user.email === "coordinador@talleres.com";
          const defecto = {
            email: user.email,
            rol: esCoord ? "coordinador" : "entrenador",
            categoriasPermitidas: esCoord ? [] : ["sub14"],
          };
          setPerfilUsuario(defecto);
        }
      } else {
        setUsuario(null);
        setPerfilUsuario(null);
        setListaEquipos([]);
        setListaPartidosViejos([]);
        setListaTodosLosProfes([]);
      }
      setCargandoAuth(false);
    });
    return () => desuscribirAuth();
  }, []);

  const cargarDatosClub = async (perfil: any) => {
    if (!perfil) return;
    try {
      const queryEquipos = await getDocs(collection(db, "equipos_club"));
      const todosLosEquipos: any[] = [];
      queryEquipos.forEach((doc: any) => {
        todosLosEquipos.push({ id: doc.id, ...doc.data() });
      });

      let equiposFiltrados = todosLosEquipos;
      if (perfil.rol !== "coordinador") {
        equiposFiltrados = todosLosEquipos.filter((eq) =>
          perfil.categoriasPermitidas?.includes(eq.id)
        );
      }
      setListaEquipos(equiposFiltrados);

      if (equiposFiltrados.length > 0) {
        const inicialId =
          equipoSeleccionado &&
          equiposFiltrados.some((e) => e.id === equipoSeleccionado)
            ? equipoSeleccionado
            : equiposFiltrados[0].id;
        setEquipoSeleccionado(inicialId);

        const eqEncontrado = equiposFiltrados.find((e) => e.id === inicialId);
        setJugadorasDelEquipo(eqEncontrado?.jugadoras || []);

        const btns =
          eqEncontrado?.botones && eqEncontrado.botones.length > 0
            ? [...eqEncontrado.botones].sort((a, b) => a.orden - b.orden)
            : BOTONES_POR_DEFECTO;
        setBotonesDinamicos(btns);
      }

      const queryPartidos = await getDocs(collection(db, "partidos_club"));
      const todosLosPartidos: any[] = [];
      queryPartidos.forEach((doc: any) => {
        todosLosPartidos.push({ id: doc.id, ...doc.data() });
      });

      let partidosFiltrados = todosLosPartidos;
      if (perfil.rol !== "coordinador") {
        partidosFiltrados = todosLosPartidos.filter((part) =>
          perfil.categoriasPermitidas?.includes(part.id_categoria)
        );
      }
      partidosFiltrados.sort((a, b) => b.fecha.localeCompare(a.fecha));
      setListaPartidosViejos(partidosFiltrados);

      if (perfil.rol === "coordinador") {
        obtenerListaProfesDeFirestore();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const obtenerListaProfesDeFirestore = async () => {
    try {
      const snapUsers = await getDocs(collection(db, "usuarios"));
      const profesCargados: any[] = [];
      snapUsers.forEach((doc) => {
        profesCargados.push({ id: doc.id, ...doc.data() });
      });
      setListaTodosLosProfes(profesCargados);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (perfilUsuario) {
      cargarDatosClub(perfilUsuario);
    }
  }, [perfilUsuario]);

  // --- MANEJADORES DE SUMA Y RESTA (CON CONTROLES DE ERRORES) ---
  const manejarSuma = async (metricaId: string) => {
    if (!idPartido) return;
    try {
      const partidoRef = doc(db, "partidos_club", idPartido);
      await updateDoc(partidRef, {
        [`estadisticas.${cuartoActual}.${metricaId}`]: increment(1),
      });
    } catch (err) {
      console.error("Error al sumar métrica:", err);
    }
  };

  const manejarResta = async (metricaId: string) => {
    if (!idPartido) return;
    const valorActual = estadisticas[cuartoActual]?.[metricaId] || 0;
    if (valorActual <= 0) return; // No permitir números negativos
    try {
      const partidoRef = doc(db, "partidos_club", idPartido);
      await updateDoc(partidRef, {
        [`estadisticas.${cuartoActual}.${metricaId}`]: increment(-1),
      });
    } catch (err) {
      console.error("Error al restar métrica:", err);
    }
  };

  const calcularTotal = (metricaId: string, statsPersonalizadas?: any) => {
    const fuente = statsPersonalizadas || estadisticas;
    let total = 0;
    ["1Q", "2Q", "3Q", "4Q"].forEach((q) => {
      total += fuente?.[q]?.[metricaId] || 0;
    });
    return total;
  };

  const manejarCambioEquipo = (id: string) => {
    setEquipoSeleccionado(id);
    const equipo = listaEquipos.find((eq) => eq.id === id);
    setJugadorasDelEquipo(equipo ? equipo.jugadoras : []);
    setTitulares([]);
    setSuplentes([]);

    const btns =
      equipo?.botones && equipo.botones.length > 0
        ? [...equipo.botones].sort((a, b) => a.orden - b.orden)
        : BOTONES_POR_DEFECTO;
    setBotonesDinamicos(btns);
  };

  const alternarPermisoCategoria = async (
    idProfe: string,
    idCat: string,
    tienePermiso: boolean
  ) => {
    try {
      const profeRef = doc(db, "usuarios", idProfe);
      if (tienePermiso) {
        await updateDoc(profeRef, { categoriasPermitidas: arrayRemove(idCat) });
      } else {
        await updateDoc(profeRef, { categoriasPermitidas: arrayUnion(idCat) });
      }
      await obtenerListaProfesDeFirestore();
    } catch (err) {
      console.error(err);
    }
  };

  const guardarBotonesEnFirestore = async (nuevosBotones: any[]) => {
    if (!equipoSeleccionado) return;
    try {
      const eqRef = doc(db, "equipos_club", equipoSeleccionado);
      await updateDoc(eqRef, { botones: nuevosBotones });
      setBotonesDinamicos(nuevosBotones.sort((a, b) => a.orden - b.orden));
      setListaEquipos((prev) =>
        prev.map((eq) =>
          eq.id === equipoSeleccionado ? { ...eq, botones: nuevosBotones } : eq
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const agregarNuevoBoton = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoBtnNombre.trim()) return;
    const idSugerido =
      "btn_" +
      nuevoBtnNombre.toLowerCase().replace(/ /g, "_") +
      "_" +
      Date.now().toString().slice(-4);
    const nuevoObj = {
      id: idSugerido,
      nombre: nuevoBtnNombre,
      color: nuevoBtnColor,
      orden: botonesDinamicos.length,
    };
    const listaActualizada = [...botonesDinamicos, nuevoObj];
    guardarBotonesEnFirestore(listaActualizada);
    setNuevoBtnNombre("");
  };

  const eliminarBotonDinamico = (idBtn: string) => {
    if (!window.confirm("¿Querés eliminar esta métrica?")) return;
    const listaFiltrada = botonesDinamicos
      .filter((b) => b.id !== idBtn)
      .map((b, index) => ({ ...b, orden: index }));
    guardarBotonesEnFirestore(listaFiltrada);
  };

  const moverOrdenBoton = (index: number, direccion: "subir" | "bajar") => {
    if (direccion === "subir" && index === 0) return;
    if (direccion === "bajar" && index === botonesDinamicos.length - 1) return;
    const nuevaLista = [...botonesDinamicos];
    const objetivoIdx = direccion === "subir" ? index - 1 : index + 1;
    const temp = nuevaLista[index];
    nuevaLista[index] = nuevaLista[objetivoIdx];
    nuevaLista[objetivoIdx] = temp;
    const listaCorregida = nuevaLista.map((b, i) => ({ ...b, orden: i }));
    guardarBotonesEnFirestore(listaCorregida);
  };

  const manejarLoginClub = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAuth("");
    const userClean = identificadorProfe.trim().toLowerCase();
    if (!userClean || !password.trim())
      return setErrorAuth("Completa los datos de acceso");

    const emailSimulado = `${userClean}@talleres.com`;

    try {
      await signInWithEmailAndPassword(auth, emailSimulado, password);
    } catch (error: any) {
      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/invalid-credential"
      ) {
        try {
          const credencial = await createUserWithEmailAndPassword(
            auth,
            emailSimulado,
            password
          );
          const esCoord = userClean === "coordinador";

          const nuevoPerfil = {
            email: emailSimulado,
            identificador: userClean,
            rol: esCoord ? "coordinador" : "entrenador",
            categoriasPermitidas: esCoord ? [] : ["sub14"],
          };

          await setDoc(doc(db, "usuarios", credencial.user.uid), nuevoPerfil);
          setPerfilUsuario(nuevoPerfil);
        } catch (crearErr) {
          setErrorAuth("Contraseña incorrecta o error de conexión.");
        }
      } else {
        setErrorAuth("Usuario o contraseña incorrectos.");
      }
    }
  };

  const cerrarSesion = async () => {
    await signOut(auth);
  };

  const crearNuevoEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombreEquipo.trim() || !perfilUsuario) return;
    if (perfilUsuario.rol !== "coordinador")
      return alert("Solo el coordinador puede crear categorías.");
    const idSugerido = nuevoNombreEquipo.toLowerCase().replace(/ /g, "_");
    try {
      await setDoc(doc(db, "equipos_club", idSugerido), {
        nombre: nuevoNombreEquipo,
        jugadoras: [],
        botones: BOTONES_POR_DEFECTO,
      });
      setNuevoNombreEquipo("");
      const queryEquipos = await getDocs(collection(db, "equipos_club"));
      const todosLosEquipos: any[] = [];
      queryEquipos.forEach((doc: any) => {
        todosLosEquipos.push({ id: doc.id, ...doc.data() });
      });
      setListaEquipos(todosLosEquipos);
    } catch (e) {
      console.error(e);
    }
  };

  const agregarJugadorasAlEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevasJugadorasTexto.trim() || !equipoSeleccionado || !perfilUsuario)
      return;
    const nuevasJugadorasArr = nuevasJugadorasTexto
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    try {
      await updateDoc(doc(db, "equipos_club", equipoSeleccionado), {
        jugadoras: arrayUnion(...nuevasJugadorasArr),
      });
      setNuevasJugadorasTexto("");
      const docRef = await getDoc(doc(db, "equipos_club", equipoSeleccionado));
      if (docRef.exists()) setJugadorasDelEquipo(docRef.data().jugadoras || []);
    } catch (e) {
      console.error(e);
    }
  };

  const modificarNombreJugadora = async (nombreViejo: string) => {
    if (!nuevoNombreEditado.trim() || !equipoSeleccionado || !perfilUsuario)
      return;
    if (nombreViejo === nuevoNombreEditado.trim()) {
      setJugadoraEditando(null);
      return;
    }
    try {
      const nuevoArrayJugadoras = jugadorasDelEquipo.map((j) =>
        j === nombreViejo ? nuevoNombreEditado.trim() : j
      );
      await updateDoc(doc(db, "equipos_club", equipoSeleccionado), {
        jugadoras: nuevoArrayJugadoras,
      });
      setJugadorasDelEquipo(nuevoArrayJugadoras);
      setJugadoraEditando(null);
      setNuevoNombreEditado("");
    } catch (e) {
      console.error(e);
    }
  };

  const eliminarJugadoraIndividual = async (nombreJugadora: string) => {
    if (!perfilUsuario) return;
    if (!window.confirm(`¿Querés eliminar a ${nombreJugadora}?`)) return;
    try {
      const nuevoArray = jugadorasDelEquipo.filter((j) => j !== nombreJugadora);
      await updateDoc(doc(db, "equipos_club", equipoSeleccionado), {
        jugadoras: nuevoArray,
      });
      setJugadorasDelEquipo(nuevoArray);
    } catch (e) {
      console.error(e);
    }
  };

  const asignarRol = (
    nombre: string,
    rol: "titular" | "suplente" | "ninguno"
  ) => {
    if (rol === "titular") {
      setSuplentes((prev) => prev.filter((j) => j !== nombre));
      if (!titulares.includes(nombre)) setTitulares((p) => [...p, nombre]);
    } else if (rol === "suplente") {
      setTitulares((prev) => prev.filter((j) => j !== nombre));
      if (!suplentes.includes(nombre)) setSuplentes((p) => [...p, nombre]);
    } else {
      setTitulares((prev) => prev.filter((j) => j !== nombre));
      setSuplentes((prev) => prev.filter((j) => j !== nombre));
    }
  };

  const comenzarPartidoEnBaseDeDatos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rival.trim() || !usuario) return alert("Poné el nombre del rival");
    const equipoActual = listaEquipos.find(
      (eq) => eq.id === equipoSeleccionado
    );
    const nuevoId = `${fecha}_${equipoSeleccionado}_vs_${rival
      .toLowerCase()
      .replace(/ /g, "_")}`;
    setIdPartido(nuevoId);

    const estructuraInicialEstadisticas: any = {
      "1Q": {},
      "2Q": {},
      "3Q": {},
      "4Q": {},
    };
    ["1Q", "2Q", "3Q", "4Q"].forEach((q) => {
      botonesDinamicos.forEach((b) => {
        estructuraInicialEstadisticas[q][b.id] = 0;
      });
      estructuraInicialEstadisticas[q]["goles_favor"] = 0;
      estructuraInicialEstadisticas[q]["goles_contra"] = 0;
    });

    await setDoc(doc(db, "partidos_club", nuevoId), {
      id_partido: nuevoId,
      id_categoria: equipoSeleccionado,
      club_local: "Talleres de Paraná",
      categoria: equipoActual ? equipoActual.nombre : "",
      rival,
      cancha,
      fecha,
      titulares,
      suplentes,
      estadisticas: estructuraInicialEstadisticas,
      configuracion_botones: botonesDinamicos,
    });
    setPartidoIniciado(true);
  };

  const reingresarAPartido = (partido: any) => {
    setIdPartido(partido.id_partido || partido.id);
    setRival(partido.rival || "");
    setCancha(partido.cancha || "");
    setFecha(partido.fecha || "");
    setTitulares(partido.titulares || []);
    setSuplentes(partido.suplentes || []);
    setEquipoSeleccionado(partido.id_categoria);
    setPartidoIniciado(true);
  };

  const eliminarPartidoHistorial = async (idPart: string) => {
    if (
      !window.confirm(
        "¿Estás seguro de que querés borrar permanentemente este partido del historial?"
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "partidos_club", idPart));
      setPartidoHistorialSeleccionado(null);
      if (perfilUsuario) cargarDatosClub(perfilUsuario);
    } catch (err) {
      console.error(err);
    }
  };

  const finalizarPartido = () => {
    if (window.confirm("¿Querés cerrar la mesa de este partido?")) {
      setPartidoIniciado(false);
      setCorriendo(false);
      setSegundos(0);
      setIdPartido("");
      if (perfilUsuario) cargarDatosClub(perfilUsuario);
    }
  };

  const exportarAExcel = async (partidoEspecifico: any = null) => {
    const pTarget = partidoEspecifico || {
      rival,
      fecha,
      cancha,
      titulares,
      suplentes,
      estadisticas,
      configuracion_botones: botonesDinamicos,
    };
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Planilla de Juego");
      worksheet.columns = [
        { width: 5 },
        { width: 22 },
        { width: 5 },
        { width: 22 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
      ];

      const fontNegrita = { name: "Calibri", bold: true, size: 11 };
      const borderFino = {
        top: { style: "thin" as any },
        left: { style: "thin" as any },
        bottom: { style: "thin" as any },
        right: { style: "thin" as any },
      };
      const alinearCentro = {
        horizontal: "center" as any,
        vertical: "middle" as any,
      };
      const alinearIzquierda = {
        horizontal: "left" as any,
        vertical: "middle" as any,
      };

      worksheet.mergeCells("A1:H1");
      worksheet.getCell("A1").value =
        "PLANILLA DE ANALISIS DE PARTIDO – HOCKEY";
      worksheet.getCell("A1").font = { name: "Calibri", bold: true, size: 14 };
      worksheet.getCell("A1").alignment = alinearCentro;
      worksheet.getRow(1).height = 30;

      worksheet.getRow(3).height = 22;
      worksheet.getCell("A3").value = "Club:";
      worksheet.getCell("B3").value = "Talleres de Paraná";
      worksheet.getCell("C3").value = "Rival:";
      worksheet.getCell("D3").value = pTarget.rival || "";
      worksheet.getCell("E3").value = "Fecha:";
      worksheet.getCell("F3").value = pTarget.fecha || "";
      worksheet.getCell("G3").value = "Cancha:";
      worksheet.getCell("H3").value = pTarget.cancha || "";

      ["A3", "B3", "C3", "D3", "E3", "F3", "G3", "H3"].forEach((c) => {
        worksheet.getCell(c).font = fontNegrita;
        worksheet.getCell(c).border = borderFino;
        worksheet.getCell(c).alignment = alinearCentro;
      });

      worksheet.getRow(5).height = 20;
      worksheet.mergeCells("A5:B5");
      worksheet.getCell("A5").value = "Titulares";
      worksheet.mergeCells("C5:D5");
      worksheet.getCell("C5").value = "Suplentes";
      worksheet.mergeCells("E5:H5");
      worksheet.getCell("E5").value = "Observaciones";

      const tits = pTarget.titulares || [];
      const sups = pTarget.suplentes || [];
      for (let i = 0; i < 11; i++) {
        const filaIdx = 6 + i;
        worksheet.getRow(filaIdx).height = 18;
        worksheet.getCell(`A${filaIdx}`).value = i + 1;
        worksheet.getCell(`A${filaIdx}`).border = borderFino;
        worksheet.getCell(`A${filaIdx}`).alignment = alinearCentro;
        worksheet.getCell(`B${filaIdx}`).value = tits[i] || "";
        worksheet.getCell(`B${filaIdx}`).border = borderFino;
        worksheet.getCell(`B${filaIdx}`).alignment = alinearIzquierda;
        worksheet.getCell(`C${filaIdx}`).value = i + 1;
        worksheet.getCell(`C${filaIdx}`).border = borderFino;
        worksheet.getCell(`C${filaIdx}`).alignment = alinearCentro;
        worksheet.getCell(`D${filaIdx}`).value = sups[i] || "";
        worksheet.getCell(`D${filaIdx}`).border = borderFino;
        worksheet.getCell(`D${filaIdx}`).alignment = alinearIzquierda;
      }
      worksheet.mergeCells("E6:H16");
      worksheet.getCell("E6").border = borderFino;

      worksheet.getRow(18).height = 20;
      worksheet.mergeCells("A18:C18");
      worksheet.getCell("A18").value = "OBJETIVOS OFENSIVOS";
      worksheet.getCell("A18").font = fontNegrita;
      worksheet.mergeCells("D18:F18");
      worksheet.getCell("D18").value = "OBJETIVOS DEFENSIVOS";
      worksheet.getCell("D18").font = fontNegrita;

      worksheet.getRow(21).height = 22;
      const headersTabla = [
        { c: "A21", v: "Cuarto" },
        { c: "B21", v: "Ingresos área" },
        { c: "C21", v: "Tiros" },
        { c: "D21", v: "Pérdidas" },
        { c: "E21", v: "Cortos Favor" },
        { c: "F21", v: "Cortos Contra" },
        { c: "G21", v: "Goles" },
      ];
      headersTabla.forEach((h) => {
        worksheet.getCell(h.c).value = h.v;
        worksheet.getCell(h.c).font = fontNegrita;
        worksheet.getCell(h.c).alignment = alinearCentro;
        worksheet.getCell(h.c).border = borderFino;
      });

      const mapeoMetricas = [
        { col: "B", id: "ingresos_area_favor" },
        { col: "C", id: "tiros_favor" },
        { col: "D", id: "perdidas" },
        { col: "E", id: "cortos_favor" },
        { col: "F", id: "cortos_contra" },
        { col: "G", id: "goles_favor" },
      ];
      const cuartosKeys = ["1Q", "2Q", "3Q", "4Q"];
      const cuartosEtiquetas = ["1°", "2°", "3°", "4°"];

      cuartosKeys.forEach((qKey, idx) => {
        const filaW = 22 + idx;
        worksheet.getRow(filaW).height = 20;
        worksheet.getCell(`A${filaW}`).value = cuartosEtiquetas[idx];
        worksheet.getCell(`A${filaW}`).border = borderFino;
        worksheet.getCell(`A${filaW}`).alignment = alinearCentro;
        mapeoMetricas.forEach((m) => {
          worksheet.getCell(`${m.col}${filaW}`).value =
            pTarget.estadisticas?.[qKey]?.[m.id] || 0;
          worksheet.getCell(`${m.col}${filaW}`).border = borderFino;
          worksheet.getCell(`${m.col}${filaW}`).alignment = alinearCentro;
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Planilla_${pTarget.fecha}_vs_${pTarget.rival}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
    }
  };

  if (cargandoAuth) {
    return (
      <div
        style={{
          backgroundColor: "#111827",
          color: "white",
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <h2>🔄 Cargando Mesa de Control...</h2>
      </div>
    );
  }

  // --- FORMULARIO DE LOGIN ---
  if (!usuario) {
    return (
      <div
        style={{
          backgroundColor: "#111827",
          color: "white",
          minHeight: "100vh",
          fontFamily: "sans-serif",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "16px",
        }}
      >
        <div
          style={{
            backgroundColor: "#1f2937",
            padding: "28px",
            borderRadius: "12px",
            border: "1px solid #374151",
            width: "100%",
            maxWidth: "400px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              color: "#60a5fa",
              marginTop: 0,
              marginBottom: "4px",
            }}
          >
            🏑 CLUB TALLERES
          </h2>
          <p
            style={{
              textAlign: "center",
              color: "#9ca3af",
              fontSize: "13px",
              marginTop: 0,
              marginBottom: "20px",
            }}
          >
            Análisis Colaborativo de Partidos
          </p>

          <form
            onSubmit={manejarLoginClub}
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "14px",
                  color: "#d1d5db",
                }}
              >
                Usuario / Entrenador:
              </label>
              <input
                type="text"
                value={identificadorProfe}
                onChange={(e) => setIdentificadorProfe(e.target.value)}
                placeholder="Ej: baltha o coordinador"
                style={estiloInput as any}
                required
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontSize: "14px",
                  color: "#d1d5db",
                }}
              >
                Contraseña del Club:
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
                style={estiloInput as any}
                required
              />
            </div>
            {errorAuth && (
              <div
                style={{
                  color: "#ef4444",
                  fontSize: "13px",
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                ⚠️ {errorAuth}
              </div>
            )}
            <button
              type="submit"
              style={{
                padding: "12px",
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: "bold",
                fontSize: "15px",
                cursor: "pointer",
                marginTop: "6px",
              }}
            >
              🔑 Ingresar a la Mesa
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#111827",
        color: "white",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: partidoIniciado ? "100%" : "500px",
          margin: "0 auto 12px auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#1f2937",
          padding: "10px 14px",
          borderRadius: "8px",
          border: "1px solid #374151",
        }}
      >
        <span style={{ fontSize: "13px", color: "#9ca3af" }}>
          🏃‍♂️ Usuario:{" "}
          <b style={{ color: "#60a5fa" }}>
            {usuario?.email?.split("@")[0].toUpperCase()}
          </b>{" "}
          ({perfilUsuario?.rol?.toUpperCase()})
        </span>
        <button
          onClick={cerrarSesion}
          style={{
            padding: "4px 10px",
            backgroundColor: "#374151",
            color: "#f3f4f6",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          🚪 Salir
        </button>
      </div>

      {!partidoIniciado ? (
        <div
          style={{
            maxWidth: "500px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setModoAdmin(!modoAdmin)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: modoAdmin ? "#ef4444" : "#4f46e5",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {modoAdmin ? "❌ Cerrar Panel" : "⚙️ Plantel / Botonera"}
            </button>
            <button
              onClick={() => {
                setVistaHistorial(!vistaHistorial);
                setPartidoHistorialSeleccionado(null);
              }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: vistaHistorial ? "#ef4444" : "#0284c7",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {vistaHistorial ? "❌ Cerrar Historial" : "📂 Historial"}
            </button>
          </div>

          {/* HISTORIAL */}
          {vistaHistorial && (
            <div
              style={{
                backgroundColor: "#1e293b",
                padding: "20px",
                borderRadius: "12px",
                border: "2px solid #0284c7",
              }}
            >
              <h3
                style={{ marginTop: 0, color: "#38bdf8", textAlign: "center" }}
              >
                📁 PANEL DE HISTORIAL
              </h3>
              {!partidoHistorialSeleccionado ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    maxHeight: "250px",
                    overflowY: "auto",
                  }}
                >
                  {listaPartidosViejos
                    .filter((p) => p.id_categoria === equipoSeleccionado)
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPartidoHistorialSeleccionado(p)}
                        style={{
                          padding: "12px",
                          backgroundColor: "#334155",
                          border: "1px solid #475569",
                          borderRadius: "8px",
                          color: "white",
                          textAlign: "left",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>
                          📅 {p.fecha} - <b>vs {p.rival}</b>
                        </span>
                        <span style={{ color: "#38bdf8" }}>Ver ➡️</span>
                      </button>
                    ))}
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "10px",
                    }}
                  >
                    <button
                      onClick={() => setPartidoHistorialSeleccionado(null)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#475569",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                      }}
                    >
                      ⬅️ Volver
                    </button>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() =>
                          reingresarAPartido(partidoHistorialSeleccionado)
                        }
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#2563eb",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontWeight: "bold",
                        }}
                      >
                        🏑 Reabrir
                      </button>
                      <button
                        onClick={() =>
                          exportarAExcel(partidoHistorialSeleccionado)
                        }
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#16a34a",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontWeight: "bold",
                        }}
                      >
                        📥 Excel
                      </button>
                      <button
                        onClick={() =>
                          eliminarPartidoHistorial(
                            partidoHistorialSeleccionado.id ||
                              partidoHistorialSeleccionado.id_partido
                          )
                        }
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#dc2626",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontWeight: "bold",
                        }}
                      >
                        🗑️ Borrar
                      </button>
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "12px",
                        backgroundColor: "#0f172a",
                      }}
                    >
                      <tbody>
                        <tr style={{ backgroundColor: "#1e3a8a" }}>
                          <td style={{ padding: "6px", fontWeight: "bold" }}>
                            Goles Favor
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {calcularTotal(
                              "goles_favor",
                              partidoHistorialSeleccionado.estadisticas
                            )}
                          </td>
                        </tr>
                        <tr style={{ backgroundColor: "#7f1d1d" }}>
                          <td style={{ padding: "6px", fontWeight: "bold" }}>
                            Goles Contra
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {calcularTotal(
                              "goles_contra",
                              partidoHistorialSeleccionado.estadisticas
                            )}
                          </td>
                        </tr>
                        {(
                          partidoHistorialSeleccionado.configuracion_botones ||
                          BOTONES_POR_DEFECTO
                        )
                          .filter((b: any) => !b.esGol)
                          .map((btn: any) => (
                            <tr key={btn.id}>
                              <td
                                style={{
                                  border: "1px solid #334155",
                                  padding: "6px",
                                }}
                              >
                                {btn.nombre}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #334155",
                                  padding: "6px",
                                  textAlign: "center",
                                  fontWeight: "bold",
                                }}
                              >
                                {calcularTotal(
                                  btn.id,
                                  partidoHistorialSeleccionado.estadisticas
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODO PANEL ADMIN */}
          {modoAdmin && (
            <div
              style={{
                backgroundColor: "#1e293b",
                padding: "20px",
                borderRadius: "12px",
                border: "2px dashed #4f46e5",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {perfilUsuario?.rol === "coordinador" && (
                <>
                  <form
                    onSubmit={crearNuevoEquipo}
                    style={{ display: "flex", gap: "8px" }}
                  >
                    <input
                      type="text"
                      value={nuevoNombreEquipo}
                      onChange={(e) => setNuevoNombreEquipo(e.target.value)}
                      placeholder="Ej: Sub 14 Damas"
                      style={estiloInput as any}
                    />
                    <button
                      type="submit"
                      style={{
                        padding: "10px",
                        backgroundColor: "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: "bold",
                      }}
                    >
                      + Categoría
                    </button>
                  </form>
                  <div
                    style={{
                      backgroundColor: "#111827",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid #374151",
                    }}
                  >
                    <h4
                      style={{
                        marginTop: 0,
                        color: "#60a5fa",
                        marginBottom: "8px",
                      }}
                    >
                      📋 Habilitar Permisos Cruzados a Profes
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        maxHeight: "150px",
                        overflowY: "auto",
                        fontSize: "12px",
                      }}
                    >
                      {listaTodosLosProfes
                        .filter((p) => p.rol !== "coordinador")
                        .map((profe) => (
                          <div
                            key={profe.id}
                            style={{
                              backgroundColor: "#1f2937",
                              padding: "8px",
                              borderRadius: "4px",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                marginBottom: "4px",
                              }}
                            >
                              👤 Entrenador:{" "}
                              {profe.email?.split("@")[0].toUpperCase()}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "6px",
                              }}
                            >
                              {listaEquipos.map((eq) => {
                                const tieneAcceso =
                                  profe.categoriasPermitidas?.includes(eq.id);
                                return (
                                  <label
                                    key={eq.id}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "3px",
                                      backgroundColor: tieneAcceso
                                        ? "#1e3a8a"
                                        : "#374151",
                                      padding: "2px 4px",
                                      borderRadius: "3px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!tieneAcceso}
                                      onChange={() =>
                                        alternarPermisoCategoria(
                                          profe.id,
                                          eq.id,
                                          !!tieneAcceso
                                        )
                                      }
                                    />
                                    {eq.nombre}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}

              {/* Plantel */}
              {equipoSeleccionado && (
                <div
                  style={{
                    backgroundColor: "#111827",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  <h4
                    style={{
                      marginTop: 0,
                      color: "#10b981",
                      marginBottom: "8px",
                    }}
                  >
                    👥 Modificar Plantel de Jugadoras
                  </h4>
                  <form
                    onSubmit={agregarJugadorasAlEquipo}
                    style={{
                      display: "flex",
                      gap: "6px",
                      marginBottom: "12px",
                    }}
                  >
                    <input
                      type="text"
                      value={nuevasJugadorasTexto}
                      onChange={(e) => setNuevasJugadorasTexto(e.target.value)}
                      placeholder="Nombres separados por coma"
                      style={estiloInput as any}
                    />
                    <button
                      type="submit"
                      style={{
                        padding: "10px",
                        backgroundColor: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: "bold",
                      }}
                    >
                      +
                    </button>
                  </form>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      maxHeight: "180px",
                      overflowY: "auto",
                      backgroundColor: "#1f2937",
                      padding: "8px",
                      borderRadius: "6px",
                    }}
                  >
                    {jugadorasDelEquipo.map((j) => (
                      <div
                        key={j}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          backgroundColor: "#374151",
                          padding: "6px 10px",
                          borderRadius: "6px",
                        }}
                      >
                        {jugadoraEditando === j ? (
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              width: "100%",
                            }}
                          >
                            <input
                              type="text"
                              value={nuevoNombreEditado}
                              onChange={(e) =>
                                setNuevoNombreEditado(e.target.value)
                              }
                              style={
                                {
                                  ...estiloInput,
                                  padding: "4px 8px",
                                  fontSize: "13px",
                                } as any
                              }
                            />
                            <button
                              type="button"
                              onClick={() => modificarNombreJugadora(j)}
                              style={{
                                backgroundColor: "#10b981",
                                border: "none",
                                borderRadius: "4px",
                                color: "white",
                                padding: "4px 10px",
                                cursor: "pointer",
                              }}
                            >
                              💾
                            </button>
                            <button
                              type="button"
                              onClick={() => setJugadoraEditando(null)}
                              style={{
                                backgroundColor: "#6b7280",
                                border: "none",
                                borderRadius: "4px",
                                color: "white",
                                padding: "4px 10px",
                                cursor: "pointer",
                              }}
                            >
                              ❌
                            </button>
                          </div>
                        ) : (
                          <>
                            <span style={{ fontSize: "13px" }}>{j}</span>
                            <div style={{ display: "flex", gap: "10px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setJugadoraEditando(j);
                                  setNuevoNombreEditado(j);
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#60a5fa",
                                  cursor: "pointer",
                                }}
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => eliminarJugadoraIndividual(j)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#f87171",
                                  cursor: "pointer",
                                }}
                              >
                                ×
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botonera */}
              {equipoSeleccionado && (
                <div
                  style={{
                    backgroundColor: "#111827",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  <h4
                    style={{
                      marginTop: 0,
                      color: "#818cf8",
                      marginBottom: "8px",
                    }}
                  >
                    🎛️ Configurar Botones
                  </h4>
                  <form
                    onSubmit={agregarNuevoBoton}
                    style={{
                      display: "flex",
                      gap: "6px",
                      marginBottom: "12px",
                    }}
                  >
                    <input
                      type="text"
                      value={nuevoBtnNombre}
                      onChange={(e) => setNuevoBtnNombre(e.target.value)}
                      placeholder="Métrica"
                      style={estiloInput as any}
                    />
                    <select
                      value={nuevoBtnColor}
                      onChange={(e) => setNuevoBtnColor(e.target.value)}
                      style={estiloInput as any}
                    >
                      {PALETA_COLORES.map((c) => (
                        <option key={c.hex} value={c.hex}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      style={{
                        padding: "10px",
                        backgroundColor: "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                      }}
                    >
                      ➕
                    </button>
                  </form>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      maxHeight: "150px",
                      overflowY: "auto",
                    }}
                  >
                    {botonesDinamicos.map((btn, idx) => (
                      <div
                        key={btn.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          backgroundColor: "#1f2937",
                          padding: "6px",
                          borderRadius: "4px",
                          borderLeft: `4px solid ${btn.color}`,
                        }}
                      >
                        <span style={{ fontSize: "13px" }}>{btn.nombre}</span>
                        <div style={{ display: "flex", gap: "3px" }}>
                          <button
                            type="button"
                            onClick={() => moverOrdenBoton(idx, "subir")}
                            disabled={idx === 0}
                          >
                            🔼
                          </button>
                          <button
                            type="button"
                            onClick={() => moverOrdenBoton(idx, "bajar")}
                            disabled={idx === botonesDinamicos.length - 1}
                          >
                            🔽
                          </button>
                          {!btn.esGol && (
                            <button
                              type="button"
                              onClick={() => eliminarBotonDinamico(btn.id)}
                              style={{ color: "#f87171" }}
                            >
                              ❌
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PARTIDO NUEVO */}
          <div
            style={{
              backgroundColor: "#1f2937",
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid #374151",
            }}
          >
            <h2
              style={{
                textAlign: "center",
                color: "#60a5fa",
                marginTop: 0,
                marginBottom: "16px",
              }}
            >
              🏑 CONFIGURAR PARTIDO
            </h2>
            <form
              onSubmit={comenzarPartidoEnBaseDeDatos}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  Categoría Abierta:
                </label>
                <select
                  value={equipoSeleccionado}
                  onChange={(e) => manejarCambioEquipo(e.target.value)}
                  style={estiloInput as any}
                >
                  {listaEquipos.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {listaEquipos.length > 0 && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                    }}
                  >
                    <input
                      type="text"
                      value={rival}
                      onChange={(e) => setRival(e.target.value)}
                      placeholder="Rival"
                      style={estiloInput as any}
                      required
                    />
                    <input
                      type="text"
                      value={cancha}
                      onChange={(e) => setCancha(e.target.value)}
                      placeholder="Cancha"
                      style={estiloInput as any}
                    />
                  </div>

                  <h3
                    style={{
                      borderBottom: "1px solid #4b5563",
                      paddingBottom: "6px",
                      color: "#9ca3af",
                      marginBottom: "4px",
                      fontSize: "14px",
                    }}
                  >
                    📋 Convocadas ({titulares.length} Tit. / {suplentes.length}{" "}
                    Sup.)
                  </h3>

                  <div
                    style={{
                      maxHeight: "180px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      backgroundColor: "#111827",
                      padding: "8px",
                      borderRadius: "8px",
                      border: "1px solid #374151",
                    }}
                  >
                    {jugadorasDelEquipo.length === 0 ? (
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#6b7280",
                          textAlign: "center",
                          padding: "12px",
                        }}
                      >
                        Plantel vacío. Carga jugadoras arriba.
                      </div>
                    ) : (
                      jugadorasDelEquipo.map((j) => {
                        const esT = titulares.includes(j);
                        const esS = suplentes.includes(j);
                        return (
                          <div
                            key={j}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              backgroundColor: "#2d3748",
                              padding: "6px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            <span style={{ fontSize: "13px" }}>{j}</span>
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button
                                type="button"
                                onClick={() =>
                                  asignarRol(j, esT ? "ninguno" : "titular")
                                }
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  border: "none",
                                  cursor: "pointer",
                                  fontWeight: "bold",
                                  backgroundColor: esT ? "#15803d" : "#4b5563",
                                  color: "white",
                                  fontSize: "11px",
                                }}
                              >
                                {esT ? "✓ Tit" : "Tit"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  asignarRol(j, esS ? "ninguno" : "suplente")
                                }
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  border: "none",
                                  cursor: "pointer",
                                  fontWeight: "bold",
                                  backgroundColor: esS ? "#b45309" : "#4b5563",
                                  color: "white",
                                  fontSize: "11px",
                                }}
                              >
                                {esS ? "✓ Banco" : "Banco"}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <button
                    type="submit"
                    style={{
                      padding: "14px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "#2563eb",
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "16px",
                      cursor: "pointer",
                    }}
                  >
                    🚀 INICIAR PARTIDO
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      ) : (
        /* ---------------- MODO JUEGO ACTIVO ---------------- */
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <button
              onClick={finalizarPartido}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: "#dc2626",
                color: "white",
                border: "none",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              🚩 Salir de Mesa
            </button>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => setVista("telefono")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "12px",
                  backgroundColor: vista === "telefono" ? "#6366f1" : "#374151",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                📲 Cel
              </button>
              <button
                onClick={() => setVista("computadora")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "12px",
                  backgroundColor:
                    vista === "computadora" ? "#6366f1" : "#374151",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                💻 PC
              </button>
            </div>
          </div>

          {/* VISTA MÓVIL */}
          {vista === "telefono" && (
            <div
              style={{
                maxWidth: "460px",
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#1f2937",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid #374151",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "24px",
                    alignItems: "center",
                    backgroundColor: "#111827",
                    padding: "6px 20px",
                    borderRadius: "30px",
                    border: "1px solid #4b5563",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#60a5fa",
                        fontWeight: "bold",
                      }}
                    >
                      CAT
                    </div>
                    <div
                      style={{
                        fontSize: "24px",
                        fontFamily: "monospace",
                        fontWeight: "bold",
                        color: "#f3f4f6",
                      }}
                    >
                      {calcularTotal("goles_favor")}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#4b5563",
                      fontWeight: "bold",
                    }}
                  >
                    VS
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#ef4444",
                        fontWeight: "bold",
                      }}
                    >
                      RIVAL
                    </div>
                    <div
                      style={{
                        fontSize: "24px",
                        fontFamily: "monospace",
                        fontWeight: "bold",
                        color: "#f3f4f6",
                      }}
                    >
                      {calcularTotal("goles_contra")}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "42px",
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    color: "#10b981",
                  }}
                >
                  {formatearTiempo(segundos)}
                </div>
                <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                  <button
                    onClick={() => setCorriendo(!corriendo)}
                    style={{
                      flex: 2,
                      padding: "10px",
                      borderRadius: "8px",
                      border: "none",
                      fontWeight: "bold",
                      backgroundColor: corriendo ? "#e11d48" : "#2563eb",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    {corriendo ? "⏸️ PAUSA" : "▶️ PLAY"}
                  </button>
                  <button
                    onClick={() => setSegundos(0)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "#4b5563",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    🔄 Reset
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "6px",
                }}
              >
                {["1Q", "2Q", "3Q", "4Q"].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setCuartoActual(q);
                      setSegundos(0);
                      setCorriendo(false);
                    }}
                    style={{
                      padding: "8px 0",
                      fontWeight: "bold",
                      border: "none",
                      borderRadius: "6px",
                      backgroundColor:
                        cuartoActual === q ? "#2563eb" : "#374151",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                {botonesDinamicos.map((btn) => {
                  const valor = estadisticas[cuartoActual]?.[btn.id] || 0;
                  if (btn.esGol) {
                    return (
                      <button
                        key={btn.id}
                        onClick={() => setMostrarSubmenuGol(true)}
                        style={{
                          padding: "20px 10px",
                          borderRadius: "10px",
                          border: "none",
                          color: "white",
                          fontWeight: "bold",
                          fontSize: "16px",
                          cursor: "pointer",
                          backgroundColor: btn.color,
                          boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
                          gridColumn: "1 / -1",
                        }}
                      >
                        {btn.nombre}
                      </button>
                    );
                  }
                  return (
                    <div
                      key={btn.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        backgroundColor: "#1f2937",
                        borderRadius: "10px",
                        overflow: "hidden",
                        border: "1px solid #374151",
                      }}
                    >
                      <button
                        onClick={() => manejarSuma(btn.id)}
                        style={{
                          flex: 1,
                          padding: "18px 10px",
                          border: "none",
                          color: "white",
                          fontWeight: "bold",
                          fontSize: "15px",
                          cursor: "pointer",
                          backgroundColor: btn.color,
                        }}
                      >
                        {btn.nombre}
                        <div
                          style={{
                            fontSize: "24px",
                            fontFamily: "monospace",
                            marginTop: "4px",
                          }}
                        >
                          {valor}
                        </div>
                      </button>
                      <button
                        onClick={() => manejarResta(btn.id)}
                        style={{
                          padding: "6px",
                          backgroundColor: "#374151",
                          color: "#9ca3af",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "12px",
                          borderTop: "1px solid #4b5563",
                        }}
                      >
                        Menos (-)
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUBMENÚ GOL */}
          {mostrarSubmenuGol && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(0,0,0,0.8)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 9999,
                padding: "16px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#1f2937",
                  padding: "24px",
                  borderRadius: "16px",
                  width: "100%",
                  maxWidth: "360px",
                  border: "2px solid #d97706",
                  textAlign: "center",
                }}
              >
                <h3
                  style={{ marginTop: 0, color: "#fbbf24", fontSize: "20px" }}
                >
                  ⚽ ¡REGISTRAR GOL!
                </h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    marginTop: "14px",
                  }}
                >
                  <button
                    onClick={() => {
                      manejarSuma("goles_favor");
                      setMostrarSubmenuGol(false);
                    }}
                    style={{
                      padding: "16px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "#16a34a",
                      color: "white",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    🟢 GOL A FAVOR
                  </button>
                  <button
                    onClick={() => {
                      manejarSuma("goles_contra");
                      setMostrarSubmenuGol(false);
                    }}
                    style={{
                      padding: "16px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "#dc2626",
                      color: "white",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    🔴 GOL EN CONTRA
                  </button>
                  <button
                    onClick={() => setMostrarSubmenuGol(false)}
                    style={{
                      padding: "10px",
                      backgroundColor: "#4b5563",
                      color: "#d1d5db",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    ❌ Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VISTA ESCRITORIO */}
          {vista === "computadora" && (
            <div style={{ maxWidth: "950px", margin: "0 auto" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: "12px",
                }}
              >
                <button
                  onClick={() => exportarAExcel(null)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#16a34a",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  📥 Excel (.xlsx)
                </button>
              </div>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  backgroundColor: "#1f2937",
                }}
              >
                <thead>
                  <tr>
                    <th style={estiloCellTh as any}>Métrica</th>
                    <th style={estiloCellTh as any}>1Q</th>
                    <th style={estiloCellTh as any}>2Q</th>
                    <th style={estiloCellTh as any}>3Q</th>
                    <th style={estiloCellTh as any}>4Q</th>
                    <th
                      style={
                        { ...estiloCellTh, backgroundColor: "#2563eb" } as any
                      }
                    >
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ backgroundColor: "#065f46" }}>
                    <td
                      style={
                        {
                          ...estiloCellTd,
                          textAlign: "left",
                          fontWeight: "bold",
                        } as any
                      }
                    >
                      ⚽ Goles a Favor
                    </td>
                    <td>{estadisticas["1Q"]?.["goles_favor"] || 0}</td>
                    <td>{estadisticas["2Q"]?.["goles_favor"] || 0}</td>
                    <td>{estadisticas["3Q"]?.["goles_favor"] || 0}</td>
                    <td>{estadisticas["4Q"]?.["goles_favor"] || 0}</td>
                    <td
                      style={{ backgroundColor: "#047857", fontWeight: "bold" }}
                    >
                      {calcularTotal("goles_favor")}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: "#7f1d1d" }}>
                    <td
                      style={
                        {
                          ...estiloCellTd,
                          textAlign: "left",
                          fontWeight: "bold",
                        } as any
                      }
                    >
                      ⚽ Goles en Contra
                    </td>
                    <td>{estadisticas["1Q"]?.["goles_contra"] || 0}</td>
                    <td>{estadisticas["2Q"]?.["goles_contra"] || 0}</td>
                    <td>{estadisticas["3Q"]?.["goles_contra"] || 0}</td>
                    <td>{estadisticas["4Q"]?.["goles_contra"] || 0}</td>
                    <td
                      style={{ backgroundColor: "#b91c1c", fontWeight: "bold" }}
                    >
                      {calcularTotal("goles_contra")}
                    </td>
                  </tr>
                  {botonesDinamicos
                    .filter((b) => !b.esGol)
                    .map((btn) => (
                      <tr key={btn.id}>
                        <td
                          style={
                            {
                              ...estiloCellTd,
                              textAlign: "left",
                              fontWeight: "bold",
                              borderLeft: `5px solid ${btn.color}`,
                            } as any
                          }
                        >
                          {btn.nombre}
                        </td>
                        <td>{estadisticas["1Q"]?.[btn.id] || 0}</td>
                        <td>{estadisticas["2Q"]?.[btn.id] || 0}</td>
                        <td>{estadisticas["3Q"]?.[btn.id] || 0}</td>
                        <td>{estadisticas["4Q"]?.[btn.id] || 0}</td>
                        <td
                          style={{
                            backgroundColor: "#1e3a8a",
                            fontWeight: "bold",
                          }}
                        >
                          {calcularTotal(btn.id)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Estilos globales de fallback
const estiloInput = {
  width: "100%",
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #4b5563",
  backgroundColor: "#1f2937",
  color: "white",
  fontSize: "14px",
  boxSizing: "border-box" as "border-box",
};

const estiloCellTh = {
  padding: "12px",
  border: "1px solid #374151",
  backgroundColor: "#1f2937",
  color: "#f3f4f6",
  textAlign: "center" as "center",
  fontSize: "13px",
};

const estiloCellTd = {
  padding: "12px",
  border: "1px solid #374151",
  textAlign: "center" as "center",
  fontSize: "14px",
};
