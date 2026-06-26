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

const PALETA_COLORES = [
  { nombre: "Verde Éxito", hex: "#15803d" },
  { nombre: "Rojo Alerta", hex: "#b91c1c" },
  { nombre: "Azul Táctico", hex: "#1d4ed8" },
  { nombre: "Amarillo Alerta", hex: "#b45309" },
  { nombre: "Negro", hex: "#1f2937" },
  { nombre: "Morado Especial", hex: "#6b21a8" },
  { nombre: "Gris Neutro", hex: "#4b5563" },
];

const BOTONES_POR_DEFECTO = [
  {
    id: "goles_menu",
    nombre: "⚽ ¡GOL!",
    color: "#d97706",
    orden: 0,
    esGol: true,
    subetiquetas: [],
  },
  {
    id: "ingresos_area_favor",
    nombre: "Área Favor",
    color: "#15803d",
    orden: 1,
    subetiquetas: ["Conducción", "Pegada", "Desborde"],
  },
  {
    id: "ingresos_area_contra",
    nombre: "Área Contra",
    color: "#b91c1c",
    orden: 2,
    subetiquetas: ["Fondo", "Centro", "Contragolpe"],
  },
  {
    id: "tiros_favor",
    nombre: "Tiro Favor",
    color: "#166534",
    orden: 3,
    subetiquetas: ["Pegada", "Barrida", "Desvío"],
  },
  {
    id: "tiros_contra",
    nombre: "Tiro Contra",
    color: "#991b1b",
    orden: 4,
    subetiquetas: ["Pegada", "Barrida", "Desvío"],
  },
  {
    id: "cortos_favor",
    nombre: "Corto Favor",
    color: "#059669",
    orden: 5,
    subetiquetas: ["Directo", "Jugada", "Rebote"],
  },
  {
    id: "cortos_contra",
    nombre: "Corto Contra",
    color: "#e11d48",
    orden: 6,
    subetiquetas: ["Directo", "Jugada", "Rebote"],
  },
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

  // Estados para la edición e individualización de botones
  const [botonEditandoNombre, setBotonEditandoNombre] = useState<string | null>(
    null
  );
  const [nuevoNombreBotonEditado, setNuevoNombreBotonEditado] =
    useState<string>("");

  const [nuevoBtnNombre, setNuevoBtnNombre] = useState<string>("");
  const [nuevoBtnColor, setNuevoBtnColor] = useState<string>("#4b5563");

  const [textoNuevaSubetiqueta, setTextoNuevaSubetiqueta] = useState<{
    [key: string]: string;
  }>({});
  const [pestañaActiva, setPestañaActiva] = useState<"partido" | "acumuladas">(
    "partido"
  );

  // --- ESTADOS PARA MODALES FLOTANTES EN PARTIDO ---
  const [mostrarSubmenuGol, setMostrarSubmenuGol] = useState<boolean>(false);
  const [botonActivoSubmenu, setBotonActivoSubmenu] = useState<any | null>(
    null
  );

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

  // --- ESCUCHA EN VIVO FIREBASE ---
  useEffect(() => {
    if (partidoIniciado && idPartido) {
      const desuscribirPartido = onSnapshot(
        doc(db, "partidos_club", idPartido),
        (docSnap) => {
          if (docSnap.exists()) {
            const datos = docSnap.data();
            if (datos.estadisticas) setEstadisticas(datos.estadisticas);
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
          const userClean = user.email?.split("@")[0] || "";
          let rolAsignado = "entrenador";
          if (userClean === "admin" || userClean === "baltha")
            rolAsignado = "admin";
          else if (userClean === "coordinador") rolAsignado = "coordinador";

          const defecto = {
            email: user.email,
            rol: rolAsignado,
            categoriasPermitidas:
              rolAsignado === "admin" || rolAsignado === "coordinador"
                ? []
                : ["sub14"],
          };
          await setDoc(doc(db, "usuarios", user.uid), defecto);
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
      if (perfil.rol !== "coordinador" && perfil.rol !== "admin") {
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
      if (perfil.rol !== "coordinador" && perfil.rol !== "admin") {
        partidosFiltrados = todosLosPartidos.filter((part) =>
          perfil.categoriasPermitidas?.includes(part.id_categoria)
        );
      }
      partidosFiltrados.sort((a, b) => b.fecha.localeCompare(a.fecha));
      setListaPartidosViejos(partidosFiltrados);

      if (perfil.rol === "admin") obtenerListaProfesDeFirestore();
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
    if (perfilUsuario) cargarDatosClub(perfilUsuario);
  }, [perfilUsuario]);

  const cerrarSesion = () => {
    signOut(auth);
  };

  const finalizarPartido = () => {
    if (
      window.confirm("¿Querés cerrar las estadísticas activas de este partido?")
    ) {
      setPartidoIniciado(false);
      setCorriendo(false);
      setSegundos(0);
      setIdPartido("");
      if (perfilUsuario) cargarDatosClub(perfilUsuario);
    }
  };

  const eliminarPartidoHistorial = async (idPart: string) => {
    if (perfilUsuario?.rol !== "admin")
      return alert("Solo el administrador puede borrar partidos.");
    if (
      !window.confirm("¿Seguro que querés borrar permanentemente este partido?")
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

  // --- ENGINE DE REGISTRO CON DESGLOSE DE SUBETIQUETAS ---
  const manejarSumaMétrica = async (
    metricaId: string,
    subetiquetaNombre?: string
  ) => {
    if (!idPartido) return;
    const campoFinal = subetiquetaNombre
      ? `${metricaId}__${subetiquetaNombre.toLowerCase().replace(/ /g, "_")}`
      : metricaId;
    try {
      await updateDoc(doc(db, "partidos_club", idPartido), {
        [`estadisticas.${cuartoActual}.${campoFinal}`]: increment(1),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const manejarRestaMétrica = async (
    metricaId: string,
    subetiquetaNombre?: string
  ) => {
    if (!idPartido) return;
    const campoFinal = subetiquetaNombre
      ? `${metricaId}__${subetiquetaNombre.toLowerCase().replace(/ /g, "_")}`
      : metricaId;
    const valorActual = estadisticas[cuartoActual]?.[campoFinal] || 0;
    if (valorActual <= 0) return;
    try {
      await updateDoc(doc(db, "partidos_club", idPartido), {
        [`estadisticas.${cuartoActual}.${campoFinal}`]: increment(-1),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const calcularTotalMétrica = (campoId: string, statsPersonalizadas?: any) => {
    const fuente = statsPersonalizadas || estadisticas;
    let total = 0;
    ["1Q", "2Q", "3Q", "4Q"].forEach((q) => {
      total += fuente?.[q]?.[campoId] || 0;
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
    if (perfilUsuario?.rol !== "admin") return;
    try {
      const profeRef = doc(db, "usuarios", idProfe);
      if (tienePermiso)
        await updateDoc(profeRef, { categoriasPermitidas: arrayRemove(idCat) });
      else
        await updateDoc(profeRef, { categoriasPermitidas: arrayUnion(idCat) });
      await obtenerListaProfesDeFirestore();
    } catch (err) {
      console.error(err);
    }
  };

  const guardarBotonesEnFirestore = async (nuevosBotones: any[]) => {
    if (!equipoSeleccionado) return;
    try {
      await updateDoc(doc(db, "equipos_club", equipoSeleccionado), {
        botones: nuevosBotones,
      });
      setBotonesDinamicos(nuevosBotones.sort((a, b) => a.orden - b.orden));
    } catch (err) {
      console.error(err);
    }
  };

  // --- MODIFICACIÓN DINÁMICA DE NOMBRE DE BOTÓN ---
  const modificarNombreBoton_Confirmar = (btnId: string) => {
    if (!nuevoNombreBotonEditado.trim()) return;
    const listaActualizada = botonesDinamicos.map((b) =>
      b.id === btnId ? { ...b, nombre: nuevoNombreBotonEditado.trim() } : b
    );
    guardarBotonesEnFirestore(listaActualizada);
    setBotonEditandoNombre(null);
    setNuevoNombreBotonEditado("");
  };

  const agregarSubetiquetaA_Boton = (btnId: string) => {
    const texto = textoNuevaSubetiqueta[btnId]?.trim();
    if (!texto) return;
    const listAc = botonesDinamicos.map((b) =>
      b.id === btnId
        ? { ...b, subetiquetas: [...(b.subetiquetas || []), texto] }
        : b
    );
    guardarBotonesEnFirestore(listAc);
    setTextoNuevaSubetiqueta((prev) => ({ ...prev, [btnId]: "" }));
  };

  const eliminarSubetiquetaDe_Boton = (btnId: string, subNombre: string) => {
    const listAc = botonesDinamicos.map((b) =>
      b.id === btnId
        ? {
            ...b,
            subetiquetas: (b.subetiquetas || []).filter(
              (s: string) => s !== subNombre
            ),
          }
        : b
    );
    guardarBotonesEnFirestore(listAc);
  };

  const agregarNuevoBoton = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoBtnNombre.trim()) return;
    const idSugerido =
      "btn_" +
      nuevoBtnNombre.toLowerCase().replace(/ /g, "_") +
      "_" +
      Date.now().toString().slice(-4);
    guardarBotonesEnFirestore([
      ...botonesDinamicos,
      {
        id: idSugerido,
        nombre: nuevoBtnNombre,
        color: nuevoBtnColor,
        orden: botonesDinamicos.length,
        subetiquetas: [],
      },
    ]);
    setNuevoBtnNombre("");
  };

  const eliminarBotonDinamico = (idBtn: string) => {
    if (!window.confirm("¿Querés eliminar esta métrica?")) return;
    guardarBotonesEnFirestore(
      botonesDinamicos
        .filter((b) => b.id !== idBtn)
        .map((b, idx) => ({ ...b, orden: idx }))
    );
  };

  const moverOrdenBoton = (index: number, direccion: "subir" | "bajar") => {
    if (direccion === "subir" && index === 0) return;
    if (direccion === "bajar" && index === botonesDinamicos.length - 1) return;
    const nuevaLista = [...botonesDinamicos];
    const objIdx = direccion === "subir" ? index - 1 : index + 1;
    const temp = nuevaLista[index];
    nuevaLista[index] = nuevaLista[objIdx];
    nuevaLista[objIdx] = temp;
    guardarBotonesEnFirestore(nuevaLista.map((b, i) => ({ ...b, orden: i })));
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
          let rolAsignado = "entrenador";
          if (userClean === "admin" || userClean === "baltha")
            rolAsignado = "admin";
          else if (userClean === "coordinador") rolAsignado = "coordinador";

          const nuevoPerfil = {
            email: emailSimulado,
            identificador: userClean,
            rol: rolAsignado,
            categoriasPermitidas:
              rolAsignado === "admin" || rolAsignado === "coordinador"
                ? []
                : ["sub14"],
          };
          await setDoc(doc(db, "usuarios", credencial.user.uid), nuevoPerfil);
          setPerfilUsuario(nuevoPerfil);
        } catch (crearErr) {
          setErrorAuth("Error de red o contraseña inválida.");
        }
      } else {
        setErrorAuth("Usuario o contraseña incorrectos.");
      }
    }
  };

  const crearNuevoEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (perfilUsuario?.rol !== "admin")
      return alert("Solo el administrador puede crear categorías de raíz.");
    if (!nuevoNombreEquipo.trim()) return;
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
    if (!nuevasJugadorasTexto.trim() || !equipoSeleccionado) return;
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
    if (!nuevoNombreEditado.trim() || !equipoSeleccionado) return;
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
        (b.subetiquetas || []).forEach((s: string) => {
          const subId = `${b.id}__${s.toLowerCase().replace(/ /g, "_")}`;
          estructuraInicialEstadisticas[q][subId] = 0;
        });
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

  const obtenerEstadisticasAcumuladas = () => {
    const partidosCategoria = listaPartidosViejos.filter(
      (p) => p.id_categoria === equipoSeleccionado
    );
    const totalPartidos = partidosCategoria.length;

    const iniciales: any = {
      partidosTotales: totalPartidos,
      totales: {},
      promedios: {},
      porCuarto: { "1Q": 0, "2Q": 0, "3Q": 0, "4Q": 0 },
    };
    if (totalPartidos === 0) return iniciales;

    partidosCategoria.forEach((partido) => {
      ["1Q", "2Q", "3Q", "4Q"].forEach((q) => {
        const statsQ = partido.estadisticas?.[q] || {};
        Object.keys(statsQ).forEach((key) => {
          iniciales.totales[key] =
            (iniciales.totales[key] || 0) + (statsQ[key] || 0);
          if (
            key.includes("favor") ||
            key === "ingresos_area_favor" ||
            key === "tiros_favor"
          ) {
            iniciales.porCuarto[q] =
              (iniciales.porCuarto[q] || 0) + (statsQ[key] || 0);
          }
        });
        iniciales.totales["goles_favor"] =
          (iniciales.totales["goles_favor"] || 0) +
          (statsQ["goles_favor"] || 0);
        iniciales.totales["goles_contra"] =
          (iniciales.totales["goles_contra"] || 0) +
          (statsQ["goles_contra"] || 0);
      });
    });

    Object.keys(iniciales.totales).forEach((key) => {
      iniciales.promedios[key] = Number(
        (iniciales.totales[key] / totalPartidos).toFixed(1)
      );
    });

    return iniciales;
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
        { width: 5 },
        { width: 22 },
        { width: 5 },
        { width: 22 },
        { width: 18 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
      ];

      const fontNegrita = { name: "Calibri", bold: true, size: 11 };
      const fontNormal = { name: "Calibri", size: 11 };
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
        "PLANILLA DE ESTADÍSTICAS – CLUB TALLERES";
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

      let filaActualTabla = 21;
      worksheet.getRow(filaActualTabla).height = 22;
      const headers = [
        "Métrica / Descriptor",
        "1° Cuarto",
        "2° Cuarto",
        "3° Cuarto",
        "4° Cuarto",
        "TOTAL",
        "",
        "",
      ];
      headers.forEach((h, idx) => {
        if (idx < 6) {
          const c = worksheet.getCell(
            `${String.fromCharCode(65 + idx)}${filaActualTabla}`
          );
          c.value = h;
          c.font = fontNegrita;
          c.alignment = alinearCentro;
          c.border = borderFino;
        }
      });

      const inyectarFilaFija = (label: string, idCampo: string) => {
        filaActualTabla++;
        worksheet.getRow(filaActualTabla).height = 20;
        const cL = worksheet.getCell(`A${filaActualTabla}`);
        cL.value = label;
        cL.font = fontNegrita;
        cL.border = borderFino;
        ["1Q", "2Q", "3Q", "4Q"].forEach((q, i) => {
          const c = worksheet.getCell(
            `${String.fromCharCode(66 + i)}${filaActualTabla}`
          );
          c.value = pTarget.estadisticas?.[q]?.[idCampo] || 0;
          c.border = borderFino;
          c.alignment = alinearCentro;
        });
        const cT = worksheet.getCell(`F${filaActualTabla}`);
        cT.value = calcularTotalMétrica(idCampo, pTarget.estadisticas);
        cT.font = fontNegrita;
        cT.border = borderFino;
        cT.alignment = alinearCentro;
      };

      inyectarFilaFija("⚽ Goles a Favor (CAT)", "goles_favor");
      inyectarFilaFija("⚽ Goles en Contra (Rival)", "goles_contra");

      btnsFicha
        .filter((b: any) => !b.esGol)
        .forEach((btn: any) => {
          filaActualTabla++;
          worksheet.getRow(filaActualTabla).height = 20;
          const cL = worksheet.getCell(`A${filaActualTabla}`);
          cL.value = btn.nombre.toUpperCase();
          cL.font = fontNegrita;
          cL.border = borderFino;
          ["1Q", "2Q", "3Q", "4Q"].forEach((q, i) => {
            const c = worksheet.getCell(
              `${String.fromCharCode(66 + i)}${filaActualTabla}`
            );
            c.value = pTarget.estadisticas?.[q]?.[btn.id] || 0;
            c.border = borderFino;
            c.alignment = alinearCentro;
          });
          const cT = worksheet.getCell(`F${filaActualTabla}`);
          cT.value = calcularTotalMétrica(btn.id, pTarget.estadisticas);
          cT.font = fontNegrita;
          cT.border = borderFino;
          cT.alignment = alinearCentro;

          (btn.subetiquetas || []).forEach((sub: string) => {
            filaActualTabla++;
            worksheet.getRow(filaActualTabla).height = 18;
            const subId = `${btn.id}__${sub.toLowerCase().replace(/ /g, "_")}`;
            const cSubL = worksheet.getCell(`A${filaActualTabla}`);
            cSubL.value = `   ↳ ${sub}`;
            cSubL.font = fontNormal;
            cSubL.border = borderFino;
            ["1Q", "2Q", "3Q", "4Q"].forEach((q, i) => {
              const c = worksheet.getCell(
                `${String.fromCharCode(66 + i)}${filaActualTabla}`
              );
              c.value = pTarget.estadisticas?.[q]?.[subId] || 0;
              c.border = borderFino;
              c.alignment = alinearCentro;
            });
            const cSubT = worksheet.getCell(`F${filaActualTabla}`);
            cSubT.value = calcularTotalMétrica(subId, pTarget.estadisticas);
            cSubT.font = fontNegrita;
            cSubT.border = borderFino;
            cSubT.alignment = alinearCentro;
          });
        });

      const nombreCategoria =
        pTarget.categoria ||
        listaEquipos.find((e) => e.id === equipoSeleccionado)?.nombre ||
        "Categoría";
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Planilla_${nombreCategoria.replace(/ /g, "_")}_${
        pTarget.fecha
      }_vs_${(pTarget.rival || "Rival").replace(/ /g, "_")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
    }
  };

  const esAdmin = perfilUsuario?.rol === "admin";
  const esCoordinador = perfilUsuario?.rol === "coordinador";
  const puedeEditarBotoneraYPlantel =
    esAdmin ||
    perfilUsuario?.categoriasPermitidas?.includes(equipoSeleccionado);

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
          🏃‍♂️ Perfil:{" "}
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
          <div
            style={{
              display: "flex",
              gap: "6px",
              backgroundColor: "#1f2937",
              padding: "4px",
              borderRadius: "8px",
            }}
          >
            <button
              onClick={() => setPestañaActiva("partido")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: "none",
                backgroundColor:
                  pestañaActiva === "partido" ? "#2563eb" : "transparent",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              🏑 Registrar Partido
            </button>
            <button
              onClick={() => setPestañaActiva("acumuladas")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: "none",
                backgroundColor:
                  pestañaActiva === "acumuladas" ? "#059669" : "transparent",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              📊 Rendimiento Global
            </button>
          </div>

          {pestañaActiva === "partido" ? (
            <>
              <div style={{ display: "flex", gap: "8px" }}>
                {puedeEditarBotoneraYPlantel && (
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
                    {modoAdmin
                      ? "❌ Cerrar Ajustes"
                      : "👥 Configurar Categoría"}
                  </button>
                )}
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
                    style={{
                      marginTop: 0,
                      color: "#38bdf8",
                      textAlign: "center",
                    }}
                  >
                    📁 ARCHIVO DE PARTIDOS
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
                          {esAdmin && (
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
                          )}
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
                              <td
                                style={{ padding: "6px", fontWeight: "bold" }}
                              >
                                Goles Favor
                              </td>
                              <td style={{ textAlign: "center" }}>
                                {calcularTotalMétrica(
                                  "goles_favor",
                                  partidoHistorialSeleccionado.estadisticas
                                )}
                              </td>
                            </tr>
                            <tr style={{ backgroundColor: "#7f1d1d" }}>
                              <td
                                style={{ padding: "6px", fontWeight: "bold" }}
                              >
                                Goles Contra
                              </td>
                              <td style={{ textAlign: "center" }}>
                                {calcularTotalMétrica(
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
                                <React.Fragment key={btn.id}>
                                  <tr style={{ backgroundColor: "#1e293b" }}>
                                    <td
                                      style={{
                                        border: "1px solid #334155",
                                        padding: "6px",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {btn.nombre.toUpperCase()}
                                    </td>
                                    <td
                                      style={{
                                        border: "1px solid #334155",
                                        padding: "6px",
                                        textAlign: "center",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {calcularTotalMétrica(
                                        btn.id,
                                        partidoHistorialSeleccionado.estadisticas
                                      )}
                                    </td>
                                  </tr>
                                  {(btn.subetiquetas || []).map(
                                    (sub: string) => {
                                      const subId = `${btn.id}__${sub
                                        .toLowerCase()
                                        .replace(/ /g, "_")}`;
                                      return (
                                        <tr key={subId}>
                                          <td
                                            style={{
                                              border: "1px solid #334155",
                                              padding: "4px 6px",
                                              color: "#9ca3af",
                                              paddingLeft: "20px",
                                            }}
                                          >
                                            ↳ {sub}
                                          </td>
                                          <td
                                            style={{
                                              border: "1px solid #334155",
                                              padding: "4px",
                                              textAlign: "center",
                                              color: "#9ca3af",
                                            }}
                                          >
                                            {calcularTotalMétrica(
                                              subId,
                                              partidoHistorialSeleccionado.estadisticas
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    }
                                  )}
                                </React.Fragment>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PANEL ADMIN PROTEGIDO POR CATEGORÍA O SÚPER-ADMIN */}
              {modoAdmin && puedeEditarBotoneraYPlantel && (
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
                  {esAdmin && (
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
                  )}

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
                      👥 Cargar Jugadoras del Equipo
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
                        onChange={(e) =>
                          setNuevasJugadorasTexto(e.target.value)
                        }
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
                        gap: "8px",
                        maxHeight: "150px",
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
                                  fontWeight: "bold",
                                }}
                              >
                                💾
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
                                  gap: "12px",
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
                      🎛️ Configurar Botonera Personalizada
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
                        placeholder="Nueva Métrica Principal"
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
                        gap: "12px",
                        maxHeight: "250px",
                        overflowY: "auto",
                      }}
                    >
                      {botonesDinamicos.map((btn, idx) => (
                        <div
                          key={btn.id}
                          style={{
                            backgroundColor: "#1f2937",
                            padding: "10px",
                            borderRadius: "6px",
                            borderLeft: `5px solid ${btn.color}`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "4px",
                            }}
                          >
                            {botonEditandoNombre === btn.id ? (
                              <div
                                style={{
                                  display: "flex",
                                  gap: "4px",
                                  flex: 1,
                                  marginRight: "8px",
                                }}
                              >
                                <input
                                  type="text"
                                  value={nuevoNombreBotonEditado}
                                  onChange={(e) =>
                                    setNuevoNombreBotonEditado(e.target.value)
                                  }
                                  style={
                                    {
                                      ...estiloInput,
                                      padding: "2px 6px",
                                      fontSize: "12px",
                                    } as any
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    modificarNombreBoton_Confirmar(btn.id)
                                  }
                                  style={{
                                    backgroundColor: "#10b981",
                                    color: "white",
                                    border: "none",
                                    padding: "2px 8px",
                                    borderRadius: "4px",
                                  }}
                                >
                                  💾
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setBotonEditandoNombre(null)}
                                  style={{
                                    backgroundColor: "#6b7280",
                                    color: "white",
                                    border: "none",
                                    padding: "2px 8px",
                                    borderRadius: "4px",
                                  }}
                                >
                                  ❌
                                </button>
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: "bold",
                                    fontSize: "13px",
                                  }}
                                >
                                  {btn.nombre}
                                </span>
                                {!btn.esGol && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBotonEditandoNombre(btn.id);
                                      setNuevoNombreBotonEditado(btn.nombre);
                                    }}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "#60a5fa",
                                      cursor: "pointer",
                                      fontSize: "11px",
                                      padding: 0,
                                    }}
                                  >
                                    ✏️ Nombre
                                  </button>
                                )}
                              </div>
                            )}
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
                                  style={{
                                    color: "#f87171",
                                    border: "none",
                                    background: "none",
                                    cursor: "pointer",
                                  }}
                                >
                                  ❌
                                </button>
                              )}
                            </div>
                          </div>
                          {!btn.esGol && (
                            <div
                              style={{
                                backgroundColor: "#111827",
                                padding: "6px",
                                borderRadius: "4px",
                                marginTop: "4px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "4px",
                                  marginBottom: "4px",
                                }}
                              >
                                {(btn.subetiquetas || []).map((sub: string) => (
                                  <span
                                    key={sub}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      backgroundColor: "#374151",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      fontSize: "11px",
                                    }}
                                  >
                                    {sub}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        eliminarSubetiquetaDe_Boton(btn.id, sub)
                                      }
                                      style={{
                                        background: "none",
                                        border: "none",
                                        color: "#f87171",
                                        padding: 0,
                                        fontWeight: "bold",
                                      }}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div style={{ display: "flex", gap: "4px" }}>
                                <input
                                  type="text"
                                  value={textoNuevaSubetiqueta[btn.id] || ""}
                                  onChange={(e) =>
                                    setTextoNuevaSubetiqueta({
                                      ...textoNuevaSubetiqueta,
                                      [btn.id]: e.target.value,
                                    })
                                  }
                                  placeholder="Descriptor..."
                                  style={
                                    {
                                      ...estiloInput,
                                      padding: "4px 8px",
                                      fontSize: "12px",
                                    } as any
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    agregarSubetiquetaA_Boton(btn.id)
                                  }
                                  style={{
                                    backgroundColor: "#15803d",
                                    border: "none",
                                    borderRadius: "4px",
                                    color: "white",
                                    padding: "2px 8px",
                                    fontSize: "12px",
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CONFIGURAR PARTIDO */}
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
                  🏑 INICIAR ENCUENTRO
                </h2>
                <form
                  onSubmit={comenzarPartidoEnBaseDeDatos}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
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
                      Categoría de Juego:
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
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "4px",
                            fontSize: "13px",
                            color: "#9ca3af",
                          }}
                        >
                          Fecha:
                        </label>
                        <input
                          type="date"
                          value={fecha}
                          onChange={(e) => setFecha(e.target.value)}
                          style={estiloInput as any}
                          required
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
                        📋 Convocadas ({titulares.length} Tit. /{" "}
                        {suplentes.length} Sup.)
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
                        {jugadorasDelEquipo.map((j) => {
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
                                    backgroundColor: esT
                                      ? "#15803d"
                                      : "#4b5563",
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
                                    backgroundColor: esS
                                      ? "#b45309"
                                      : "#4b5563",
                                    color: "white",
                                    fontSize: "11px",
                                  }}
                                >
                                  {esS ? "✓ Banco" : "Banco"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
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
                        🚀 EMPEZAR PARTIDO
                      </button>
                    </>
                  )}
                </form>
              </div>
            </>
          ) : (
            /* ================= RENDIMIENTO ACUMULADO ================= */
            <div
              style={{
                backgroundColor: "#1f2937",
                padding: "20px",
                borderRadius: "12px",
                border: "1px solid #059669",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <h3 style={{ margin: 0, color: "#34d399" }}>
                  📊 DESEMPEÑO GLOBAL ACUMULADO
                </h3>
                <span style={{ fontSize: "13px", color: "#9ca3af" }}>
                  Encuentros auditados de la temporada:{" "}
                  {datosAcumulados.partidosTotales}
                </span>
              </div>

              {datosAcumulados.partidosTotales === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "#9ca3af",
                    padding: "20px",
                  }}
                >
                  No hay estadísticas consolidadas en este plantel todavía.
                </p>
              ) : (
                <>
                  <div
                    style={{
                      backgroundColor: "#111827",
                      padding: "12px",
                      borderRadius: "8px",
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 10px 0",
                        color: "#60a5fa",
                        fontSize: "14px",
                      }}
                    >
                      📈 Volumen Medio por Encuentro
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {botonesDinamicos
                        .filter((b) => !b.esGol)
                        .map((btn) => (
                          <div
                            key={btn.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "13px",
                              borderBottom: "1px solid #2d3748",
                              paddingBottom: "4px",
                            }}
                          >
                            <span style={{ color: "#d1d5db" }}>
                              {btn.nombre}
                            </span>
                            <span
                              style={{ fontWeight: "bold", color: btn.color }}
                            >
                              {datosAcumulados.promedios[btn.id] || 0}{" "}
                              <span
                                style={{ fontSize: "10px", color: "#6b7280" }}
                              >
                                p/p
                              </span>
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: "#111827",
                      padding: "12px",
                      borderRadius: "8px",
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 10px 0",
                        color: "#fbbf24",
                        fontSize: "14px",
                      }}
                    >
                      📊 Distribución Ofensiva por Cuartos
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {["1Q", "2Q", "3Q", "4Q"].map((q) => {
                        const totalQ = datosAcumulados.porCuarto[q] || 0;
                        const maxVol =
                          Math.max(
                            ...(Object.values(
                              datosAcumulados.porCuarto
                            ) as number[])
                          ) || 1;
                        const porcentajeAncho = Math.min(
                          100,
                          Math.max(10, (totalQ / maxVol) * 100)
                        );
                        return (
                          <div
                            key={q}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <span
                              style={{
                                width: "25px",
                                fontSize: "12px",
                                fontWeight: "bold",
                              }}
                            >
                              {q}
                            </span>
                            <div
                              style={{
                                flex: 1,
                                backgroundColor: "#1f2937",
                                height: "18px",
                                borderRadius: "4px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${porcentajeAncho}%`,
                                  backgroundColor: "#2563eb",
                                  height: "100%",
                                }}
                              />
                            </div>
                            <span
                              style={{ fontSize: "12px", fontWeight: "bold" }}
                            >
                              {totalQ}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: "#111827",
                      padding: "12px",
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 8px 0",
                        color: "#34d399",
                        fontSize: "14px",
                      }}
                    >
                      🏑 Balance Consolidado de Cortos
                    </h4>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px",
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: "#065f46",
                          padding: "10px",
                          borderRadius: "6px",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "#a7f3d0" }}>
                          A Favor
                        </div>
                        <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                          {datosAcumulados.totales["cortos_favor"] || 0}
                        </div>
                      </div>
                      <div
                        style={{
                          backgroundColor: "#7f1d1d",
                          padding: "10px",
                          borderRadius: "6px",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "#fca5a5" }}>
                          En Contra
                        </div>
                        <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                          {datosAcumulados.totales["cortos_contra"] || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ---------------- PARTIDO ACTIVO ---------------- */
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
              🚩 Cerrar Partido
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

          {/* CELULAR */}
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
                      }}
                    >
                      {calcularTotalMétrica("goles_favor")}
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
                      }}
                    >
                      {calcularTotalMétrica("goles_contra")}
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
                  const valorPrincipal =
                    estadisticas[cuartoActual]?.[btn.id] || 0;
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
                        onClick={() => {
                          if (btn.subetiquetas && btn.subetiquetas.length > 0)
                            setBotonActivoSubmenu(btn);
                          else manejarSumaMétrica(btn.id);
                        }}
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
                          {valorPrincipal}
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          if (btn.subetiquetas && btn.subetiquetas.length > 0)
                            setBotonActivoSubmenu({ ...btn, modoResta: true });
                          else manejarRestaMétrica(btn.id);
                        }}
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
                        (-) Reducir
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FLOTANTE SUBETIQUETAS */}
          {botonActivoSubmenu && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(0,0,0,0.85)",
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
                  maxWidth: "400px",
                  border: `2px solid ${botonActivoSubmenu.color}`,
                  textAlign: "center",
                }}
              >
                <h3
                  style={{
                    marginTop: "4px",
                    color: "white",
                    fontSize: "22px",
                    marginBottom: "16px",
                  }}
                >
                  {botonActivoSubmenu.modoResta
                    ? "🗑️ RESTAR:"
                    : "📈 REGISTRAR:"}{" "}
                  {botonActivoSubmenu.nombre}
                </h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <button
                    onClick={() => {
                      if (botonActivoSubmenu.modoResta)
                        manejarRestaMétrica(botonActivoSubmenu.id);
                      else manejarSumaMétrica(botonActivoSubmenu.id);
                      setBotonActivoSubmenu(null);
                    }}
                    style={{
                      padding: "14px",
                      borderRadius: "8px",
                      border: "1px dashed #4b5563",
                      backgroundColor: "#374151",
                      color: "white",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    {botonActivoSubmenu.modoResta
                      ? "(-) Solo General"
                      : "(+) Solo General"}
                  </button>
                  {(botonActivoSubmenu.subetiquetas || []).map(
                    (sub: string) => {
                      const subId = `${botonActivoSubmenu.id}__${sub
                        .toLowerCase()
                        .replace(/ /g, "_")}`;
                      const valorSub = estadisticas[cuartoActual]?.[subId] || 0;
                      return (
                        <button
                          key={sub}
                          onClick={() => {
                            if (botonActivoSubmenu.modoResta) {
                              manejarRestaMétrica(botonActivoSubmenu.id, sub);
                              manejarRestaMétrica(botonActivoSubmenu.id);
                            } else {
                              manejarSumaMétrica(botonActivoSubmenu.id, sub);
                              manejarSumaMétrica(botonActivoSubmenu.id);
                            }
                            setBotonActivoSubmenu(null);
                          }}
                          style={{
                            padding: "16px",
                            borderRadius: "8px",
                            border: "none",
                            backgroundColor: botonActivoSubmenu.modoResta
                              ? "#991b1b"
                              : "#2563eb",
                            color: "white",
                            fontWeight: "bold",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>{sub}</span>
                          <span
                            style={{
                              backgroundColor: "rgba(0,0,0,0.3)",
                              padding: "2px 8px",
                              borderRadius: "10px",
                            }}
                          >
                            {valorSub}
                          </span>
                        </button>
                      );
                    }
                  )}
                  <button
                    onClick={() => setBotonActivoSubmenu(null)}
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

          {/* SUBMENU GOL */}
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
                      manejarSumaMétrica("goles_favor");
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
                      manejarSumaMétrica("goles_contra");
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

          {/* PC */}
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
                    <th style={estiloCellTh as any}>Métrica / Descriptor</th>
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
                          ...estiloCeldaTd,
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
                      {calcularTotalMétrica("goles_favor")}
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
                      ⚽ Goles en Contra
                    </td>
                    <td>{estadisticas["1Q"]?.["goles_contra"] || 0}</td>
                    <td>{estadisticas["2Q"]?.["goles_contra"] || 0}</td>
                    <td>{estadisticas["3Q"]?.["goles_contra"] || 0}</td>
                    <td>{estadisticas["4Q"]?.["goles_contra"] || 0}</td>
                    <td
                      style={{ backgroundColor: "#b91c1c", fontWeight: "bold" }}
                    >
                      {calcularTotalMétrica("goles_contra")}
                    </td>
                  </tr>
                  {botonesDinamicos
                    .filter((b) => !b.esGol)
                    .map((btn) => (
                      <React.Fragment key={btn.id}>
                        <tr style={{ backgroundColor: "#1e293b" }}>
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
                            {btn.nombre.toUpperCase()}
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
                            {calcularTotalMétrica(btn.id)}
                          </td>
                        </tr>
                        {(btn.subetiquetas || []).map((sub: string) => {
                          const subId = `${btn.id}__${sub
                            .toLowerCase()
                            .replace(/ /g, "_")}`;
                          return (
                            <tr key={subId}>
                              <td
                                style={
                                  {
                                    ...estiloCeldaTd,
                                    textAlign: "left",
                                    color: "#9ca3af",
                                    paddingLeft: "24px",
                                  } as any
                                }
                              >
                                ↳ {sub}
                              </td>
                              <td style={{ color: "#9ca3af" }}>
                                {estadisticas["1Q"]?.[subId] || 0}
                              </td>
                              <td style={{ color: "#9ca3af" }}>
                                {estadisticas["2Q"]?.[subId] || 0}
                              </td>
                              <td style={{ color: "#9ca3af" }}>
                                {estadisticas["3Q"]?.[subId] || 0}
                              </td>
                              <td style={{ color: "#9ca3af" }}>
                                {estadisticas["4Q"]?.[subId] || 0}
                              </td>
                              <td
                                style={{
                                  backgroundColor: "#374151",
                                  color: "#9ca3af",
                                }}
                              >
                                {calcularTotalMétrica(subId)}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
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
const estiloCeldaTd = {
  padding: "12px",
  border: "1px solid #374151",
  textAlign: "center" as "center",
  fontSize: "14px",
};
