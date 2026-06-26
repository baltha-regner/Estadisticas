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
  { font: "Gris Neutro", hex: "#4b5563" },
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

// Función auxiliar para formatear MM:SS
const formatearTiempo = (totalSegundos: number) => {
  const mins = Math.floor(totalSegundos / 60);
  const secs = totalSegundos % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

export default function App() {
  // --- ESTADOS DE AUTENTICACIÓN Y ROLES ---
  const [usuario, setUsuario] = useState<any>(null);
  const [perfilUsuario, setPerfilUsuario] = useState<any>(null);
  const [cargandoAuth, setCargandoAuth] = useState<boolean>(true);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [esRegistro, setEsRegistro] = useState<boolean>(false);
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

  // Estados para la edición directa de nombres de jugadoras
  const [jugadoraEditando, setJugadoraEditando] = useState<string | null>(null);
  const [nuevoNombreEditado, setNuevoNombreEditado] = useState<string>("");

  // Estados para la creación de un nuevo botón dinámico
  const [nuevoBtnNombre, setNuevoBtnNombre] = useState<string>("");
  const [nuevoBtnColor, setNuevoBtnColor] = useState<string>("#4b5563");

  // --- ESTADO PARA SUBMENÚ FLOTANTE ---
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

  // --- ESTADOS PARA EL HISTORIAL ---
  const [listaPartidosViejos, setListaPartidosViejos] = useState<any[]>([]);
  const [partidoHistorialSeleccionado, setPartidoHistorialSeleccionado] =
    useState<any>(null);
  const [vistaHistorial, setVistaHistorial] = useState<boolean>(false);

  // --- TIMER DEL CRONÓMETRO ---
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

  // --- CONTROLADOR DEL ESTADO DE SESIÓN ---
  useEffect(() => {
    const desuscribirAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuario(user);
        const docSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (docSnap.exists()) {
          setPerfilUsuario(docSnap.data());
        } else {
          const defecto = {
            email: user.email,
            rol: "entrenador",
            categoriasPermitidas: [],
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

  // --- CARGA CENTRALIZADA Y FILTRADA POR PERMISOS ---
  const cargarDatosClub = async (perfil: any) => {
    if (!perfil) return;
    try {
      const queryEquipos = await getDocs(collection(db, "equipos_club"));
      const todosLosEquipos: any[] = [];
      querySnapshotToArray(queryEquipos, todosLosEquipos);

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
      querySnapshotToArray(queryPartidos, todosLosPartidos);

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
      console.error("Error al cargar datos globales del club: ", e);
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

  const querySnapshotToArray = (snapshot: any, arr: any[]) => {
    snapshot.forEach((doc: any) => {
      arr.push({ id: doc.id, ...doc.data() });
    });
  };

  useEffect(() => {
    if (perfilUsuario) {
      cargarDatosClub(perfilUsuario);
    }
  }, [perfilUsuario]);

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

  const manejarAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAuth("");
    try {
      if (esRegistro) {
        const credencial = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await setDoc(doc(db, "usuarios", credencial.user.uid), {
          email: email,
          rol: "entrenador",
          categoriasPermitidas: [],
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error(error);
      setErrorAuth("Error en la autenticación.");
    }
  };

  const cerrarSesion = () => {
    if (window.confirm("¿Querés cerrar sesión?")) {
      signOut(auth);
      setPartidoIniciado(false);
    }
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
      querySnapshotToArray(queryEquipos, todosLosEquipos);
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
      console.error("Error al editar jugadora: ", e);
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

  // --- ESCUCHA EN VIVO DEL PARTIDO ---
  useEffect(() => {
    if (!idPartido || !usuario) return;
    const desuscribir = onSnapshot(
      doc(db, "partidos_club", idPartido),
      (docSnap) => {
        if (docSnap.exists()) {
          const datos = docSnap.data();
          if (datos.estadisticas) setEstadisticas(datos.estadisticas);
          if (datos.rival) setRival(datos.rival);
          if (datos.cancha) setCancha(datos.cancha);
          if (datos.fecha) setFecha(datos.fecha);
          if (datos.titulares) setTitulares(datos.titulares);
          if (datos.suplentes) setSuplentes(datos.suplentes);
          setPartidoIniciado(true);
        }
      }
    );
    return () => desuscribir();
  }, [idPartido, usuario]);

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

  const manejarSuma = async (campo: string) => {
    if (!usuario) return;
    const valorActual = estadisticas[cuartoActual]?.[campo] || 0;
    try {
      await updateDoc(doc(db, "partidos_club", idPartido), {
        [`estadisticas.${cuartoActual}.${campo}`]: valorActual + 1,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const manejarResta = async (campo: string) => {
    if (!usuario) return;
    const valorActual = estadisticas[cuartoActual]?.[campo] || 0;
    if (valorActual <= 0) return;
    try {
      await updateDoc(doc(db, "partidos_club", idPartido), {
        [`estadisticas.${cuartoActual}.${campo}`]: valorActual - 1,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const finalizarPartido = () => {
    if (window.confirm("¿Querés cerrar la mesa de control?")) {
      setCorriendo(false);
      setSegundos(0);
      setPartidoIniciado(false);
      setIdPartido("");
      setRival("");
      setCancha("");
      setTitulares([]);
      setSuplentes([]);
      if (perfilUsuario) cargarDatosClub(perfilUsuario);
    }
  };

  const reingresarAPartido = (p: any) => {
    setIdPartido(p.id);
    setRival(p.rival);
    setCancha(p.cancha || "");
    setFecha(p.fecha);
    setTitulares(p.titulares || []);
    setSuplentes(p.suplentes || []);
    if (p.estadisticas) setEstadisticas(p.estadisticas);
    if (p.configuracion_botones) setBotonesDinamicos(p.configuracion_botones);
    setVistaHistorial(false);
    setPartidoHistorialSeleccionado(null);
    setPartidoIniciado(true);
  };

  const eliminarPartidoHistorial = async (idPart: string) => {
    if (!perfilUsuario) return;
    if (!window.confirm("¿Querés ELIMINAR este partido definitivamente?"))
      return;
    try {
      await deleteDoc(doc(db, "partidos_club", idPart));
      setPartidoHistorialSeleccionado(null);
      await cargarDatosClub(perfilUsuario);
    } catch (e) {
      console.error(e);
    }
  };

  const asignarRol = (nombre: string, rol: string) => {
    const tFiltrado = titulares.filter((j) => j !== nombre);
    const sFiltrado = suplentes.filter((j) => j !== nombre);
    if (rol === "titular") {
      setTitulares([...tFiltrado, nombre]);
      setSuplentes(sFiltrado);
    } else if (rol === "suplente") {
      setSuplentes([...sFiltrado, nombre]);
      setTitulares(tFiltrado);
    } else {
      setTitulares(tFiltrado);
      setSuplentes(sFiltrado);
    }
  };

  const calcularTotal = (campo: string, objEsts: any = estadisticas) => {
    if (!objEsts) return 0;
    return (
      (objEsts["1Q"]?.[campo] || 0) +
      (objEsts["2Q"]?.[campo] || 0) +
      (objEsts["3Q"]?.[campo] || 0) +
      (objEsts["4Q"]?.[campo] || 0)
    );
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
    const btnsFicha = pTarget.configuracion_botones || BOTONES_POR_DEFECTO;

    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Planilla de Juego");
      worksheet.columns = [
        { width: 26 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 16 },
      ];

      worksheet.mergeCells("A2:F2");
      worksheet.getCell("A2").value =
        "PLANILLA PERSONALIZADA - CON GOLES DISCRIMINADOS";
      worksheet.getCell("A2").font = { bold: true, size: 14 };

      worksheet.getCell("A4").value = "Categoría:";
      worksheet.getCell("B4").value = pTarget.categoria || "Talleres";
      worksheet.getCell("C4").value = "Rival:";
      worksheet.getCell("D4").value = pTarget.rival;

      const filaTabla = 8;
      const encabezados = [
        "Métrica / Botón",
        "1° Cuarto",
        "2° Cuarto",
        "3° Cuarto",
        "4° Cuarto",
        "TOTAL",
      ];
      encabezados.forEach((text, idx) => {
        worksheet.getCell(filaTabla, idx + 1).value = text;
        worksheet.getCell(filaTabla, idx + 1).font = { bold: true };
      });

      let offset = 0;
      btnsFicha.forEach((btn: any, bIdx: number) => {
        if (btn.esGol) return;
        const fAct = filaTabla + 1 + offset;
        worksheet.getCell(fAct, 1).value = btn.nombre;
        worksheet.getCell(fAct, 2).value =
          pTarget.estadisticas?.["1Q"]?.[btn.id] || 0;
        worksheet.getCell(fAct, 3).value =
          pTarget.estadisticas?.["2Q"]?.[btn.id] || 0;
        worksheet.getCell(fAct, 4).value =
          pTarget.estadisticas?.["3Q"]?.[btn.id] || 0;
        worksheet.getCell(fAct, 5).value =
          pTarget.estadisticas?.["4Q"]?.[btn.id] || 0;
        worksheet.getCell(fAct, 6).value = calcularTotal(
          btn.id,
          pTarget.estadisticas
        );
        offset++;
      });

      const filaGolesFav = filaTabla + 1 + offset;
      worksheet.getCell(filaGolesFav, 1).value = "Goles a Favor (CAT)";
      worksheet.getCell(filaGolesFav, 6).value = calcularTotal(
        "goles_favor",
        pTarget.estadisticas
      );

      const filaGolesContra = filaGolesFav + 1;
      worksheet.getCell(filaGolesContra, 1).value = "Goles en Contra (Rival)";
      worksheet.getCell(filaGolesContra, 6).value = calcularTotal(
        "goles_contra",
        pTarget.estadisticas
      );

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Estadisticas_${pTarget.fecha}_vs_${pTarget.rival}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
    }
  };

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
          🏃‍♂️ Técnico: <b>{usuario?.email}</b>
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
                          textAlignment: "left",
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
                            partidoHistorialSeleccionado.id
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
                            Goles Favor (Club)
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
                            Goles Contra (Rival)
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

          {/* PANEL ADMIN */}
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
                      📋 Permisos de Profes
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
                              📧 {profe.email}
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

              {/* Modificar Plantel de Jugadoras */}
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
                    👥 Cargar / Modificar Jugadoras
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
                      placeholder="Nombres separados por coma (Ej: Juana, Meli)"
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
                    {jugadorasDelEquipo.length === 0 ? (
                      <span style={{ color: "#6b7280", fontSize: "13px" }}>
                        Sin jugadoras cargadas todavía.
                      </span>
                    ) : (
                      jugadorasDelEquipo.map((j) => (
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
                                  fontWeight: "bold",
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
                              <span
                                style={{ fontSize: "13px", fontWeight: "bold" }}
                              >
                                {j}
                              </span>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "10px",
                                  alignItems: "center",
                                }}
                              >
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
                                    fontSize: "13px",
                                    padding: 0,
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
                                    fontWeight: "bold",
                                    fontSize: "15px",
                                    padding: 0,
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Configurar Botones */}
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
                      placeholder="Nueva Métrica"
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
                        <span style={{ fontSize: "13px" }}>
                          {btn.nombre} {btn.esGol && "⭐"}
                        </span>
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

          {/* NUEVO PARTIDO */}
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
                  Categoría a Dirigir:
                </label>
                <select
                  value={equipoSeleccionado}
                  onChange={(e) => manejarCambioEquipo(e.target.value)}
                  style={estiloInput as any}
                >
                  {listaEquipos.length === 0 && (
                    <option>No tenés categorías autorizadas.</option>
                  )}
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
                      placeholder="Nombre del Rival"
                      style={estiloInput as any}
                      required
                    />
                    <input
                      type="text"
                      value={cancha}
                      onChange={(e) => setCancha(e.target.value)}
                      placeholder="Cancha (Ej: Agua)"
                      style={estiloInput as any}
                    />
                  </div>

                  {/* 📋 LISTA DE SELECCIÓN DE TITULARES / SUPLENTES REPARADA */}
                  <h3
                    style={{
                      borderBottom: "1px solid #4b5563",
                      paddingBottom: "6px",
                      color: "#9ca3af",
                      marginBottom: "4px",
                      fontSize: "14px",
                      marginTop: "6px",
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
                        No hay jugadoras cargadas en este plantel. Cargalas
                        arriba en Plantel / Botonera.
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
                            <span
                              style={{ fontSize: "13px", fontWeight: "500" }}
                            >
                              {j}
                            </span>
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
                                {esT ? "✓ Titular" : "Titular"}
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
                      marginTop: "6px",
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
                        fontWeight: "black",
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
                        fontWeight: "black",
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
                {botonesDinamicos.map((btn) => (
                  <ComponenteBotonDinamico key={btn.id} objetoBoton={btn} />
                ))}
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
                    <th style={estiloCeldaTh as any}>Métrica</th>
                    <th style={estiloCeldaTh as any}>1Q</th>
                    <th style={estiloCeldaTh as any}>2Q</th>
                    <th style={estiloCeldaTh as any}>3Q</th>
                    <th style={estiloCeldaTh as any}>4Q</th>
                    <th
                      style={
                        { ...estiloCeldaTh, backgroundColor: "#2563eb" } as any
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
                          ...estiloCeldaTd,
                          textAlign: "left",
                          fontWeight: "bold",
                        } as any
                      }
                    >
                      ⚽ Goles a Favor (CAT)
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
                          ...estiloCeldaTd,
                          textAlign: "left",
                          fontWeight: "bold",
                        } as any
                      }
                    >
                      ⚽ Goles en Contra (Rival)
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
                              ...estiloCeldaTd,
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

// Estilos globales de fallback para los componentes dinámicos
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

const estiloCeldaTh = {
  padding: "12px",
  border: "1px solid #374151",
  backgroundColor: "#1f2937",
  color: "#f3f4f6",
  textAlign: "center" as "center",
  fontSize: "13px",
};

const estiloCeldaTd = {
  padding: "12px",
  border: "1px solid #374151",
  textAlign: "center" as "center",
  fontSize: "14px",
};
