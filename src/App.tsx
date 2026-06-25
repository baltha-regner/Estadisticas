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
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

export default function App() {
  // --- ESTADOS DE AUTENTICACIÓN Y ROLES ---
  const [usuario, setUsuario] = useState<any>(null);
  const [perfilUsuario, setPerfilUsuario] = useState<any>(null);
  const [cargandoAuth, setCargandoAuth] = useState<boolean>(true);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [esRegistro, setEsRegistro] = useState<boolean>(false);
  const [errorAuth, setErrorAuth] = useState<string>("");

  // --- ESTADOS DE GESTIÓN DE EQUIPOS ---
  const [listaEquipos, setListaEquipos] = useState<any[]>([]);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<string>("");
  const [jugadorasDelEquipo, setJugadorasDelEquipo] = useState<string[]>([]);

  const [modoAdmin, setModoAdmin] = useState<boolean>(false);
  const [nuevoNombreEquipo, setNuevoNombreEquipo] = useState<string>("");
  const [nuevasJugadorasTexto, setNuevasJugadorasTexto] = useState<string>("");

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
    "1Q": {
      ingresos_area_favor: 0,
      ingresos_area_contra: 0,
      tiros_favor: 0,
      tiros_contra: 0,
      cortos_favor: 0,
      cortos_contra: 0,
      perdidas: 0,
      recuperaciones: 0,
      goles_favor: 0,
      goles_contra: 0,
    },
    "2Q": {
      ingresos_area_favor: 0,
      ingresos_area_contra: 0,
      tiros_favor: 0,
      tiros_contra: 0,
      cortos_favor: 0,
      cortos_contra: 0,
      perdidas: 0,
      recuperaciones: 0,
      goles_favor: 0,
      goles_contra: 0,
    },
    "3Q": {
      ingresos_area_favor: 0,
      ingresos_area_contra: 0,
      tiros_favor: 0,
      tiros_contra: 0,
      cortos_favor: 0,
      cortos_contra: 0,
      perdidas: 0,
      recuperaciones: 0,
      goles_favor: 0,
      goles_contra: 0,
    },
    "4Q": {
      ingresos_area_favor: 0,
      ingresos_area_contra: 0,
      tiros_favor: 0,
      tiros_contra: 0,
      cortos_favor: 0,
      cortos_contra: 0,
      perdidas: 0,
      recuperaciones: 0,
      goles_favor: 0,
      goles_contra: 0,
    },
  });

  // --- ESTADOS PARA EL HISTORIAL ---
  const [listaPartidosViejos, setListaPartidosViejos] = useState<any[]>([]);
  const [partidoHistorialSeleccionado, setPartidoHistorialSeleccionado] =
    useState<any>(null);
  const [vistaHistorial, setVistaHistorial] = useState<boolean>(false);

  const resetearEstadisticasCompletas = () => {
    setEstadisticas({
      "1Q": {
        ingresos_area_favor: 0,
        ingresos_area_contra: 0,
        tiros_favor: 0,
        tiros_contra: 0,
        cortos_favor: 0,
        cortos_contra: 0,
        perdidas: 0,
        recuperaciones: 0,
        goles_favor: 0,
        goles_contra: 0,
      },
      "2Q": {
        ingresos_area_favor: 0,
        ingresos_area_contra: 0,
        tiros_favor: 0,
        tiros_contra: 0,
        cortos_favor: 0,
        cortos_contra: 0,
        perdidas: 0,
        recuperaciones: 0,
        goles_favor: 0,
        goles_contra: 0,
      },
      "3Q": {
        ingresos_area_favor: 0,
        ingresos_area_contra: 0,
        tiros_favor: 0,
        tiros_contra: 0,
        cortos_favor: 0,
        cortos_contra: 0,
        perdidas: 0,
        recuperaciones: 0,
        goles_favor: 0,
        goles_contra: 0,
      },
      "4Q": {
        ingresos_area_favor: 0,
        ingresos_area_contra: 0,
        tiros_favor: 0,
        tiros_contra: 0,
        cortos_favor: 0,
        cortos_contra: 0,
        perdidas: 0,
        recuperaciones: 0,
        goles_favor: 0,
        goles_contra: 0,
      },
    });
  };

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
        setEquipoSeleccionado(equiposFiltrados[0].id);
        setJugadorasDelEquipo(equiposFiltrados[0].jugadoras || []);
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
    } catch (e) {
      console.error("Error al cargar datos globales del club: ", e);
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
      resetearEstadisticasCompletas();
    }
  }, [perfilUsuario]);

  // --- MANEJO DE LOGIN / REGISTRO ---
  const manejarAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAuth("");
    if (!email.trim() || !password.trim())
      return setErrorAuth("Completa todos los campos");

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
      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/invalid-credential"
      ) {
        setErrorAuth("Credenciales inválidas.");
      } else if (error.code === "auth/email-already-in-use") {
        setErrorAuth("El correo ya está registrado por otro técnico.");
      } else if (error.code === "auth/weak-password") {
        setErrorAuth("La contraseña debe tener mínimo 6 caracteres.");
      } else {
        setErrorAuth("Ocurrió un error en la autenticación.");
      }
    }
  };

  const cerrarSesion = () => {
    if (window.confirm("¿Querés cerrar sesión?")) {
      signOut(auth);
      setPartidoIniciado(false);
    }
  };

  const manejarCambioEquipo = (id: string) => {
    setEquipoSeleccionado(id);
    const equipo = listaEquipos.find((eq) => eq.id === id);
    setJugadorasDelEquipo(equipo ? equipo.jugadoras : []);
    setTitulares([]);
    setSuplentes([]);
  };

  const crearNuevoEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombreEquipo.trim() || !perfilUsuario) return;
    if (perfilUsuario.rol !== "coordinador")
      return alert("Solo el coordinador puede crear categorías en el club.");

    const idSugerido = nuevoNombreEquipo.toLowerCase().replace(/ /g, "_");
    try {
      await setDoc(doc(db, "equipos_club", idSugerido), {
        nombre: nuevoNombreEquipo,
        jugadoras: [],
      });
      setNuevoNombreEquipo("");
      await cargarDatosClub(perfilUsuario);
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
      await cargarDatosClub(perfilUsuario);
    } catch (e) {
      console.error(e);
    }
  };

  const eliminarJugadoraIndividual = async (nombreJugadora: string) => {
    if (!perfilUsuario) return;
    const seguro = window.confirm(
      `¿Querés eliminar a ${nombreJugadora} de esta categoría?`
    );
    if (!seguro) return;
    try {
      const nuevoArray = jugadorasDelEquipo.filter((j) => j !== nombreJugadora);
      await updateDoc(doc(db, "equipos_club", equipoSeleccionado), {
        jugadoras: nuevoArray,
      });
      setJugadorasDelEquipo(nuevoArray);
      setTitulares((prev) => prev.filter((j) => j !== nombreJugadora));
      setSuplentes((prev) => prev.filter((j) => j !== nombreJugadora));
      await cargarDatosClub(perfilUsuario);
    } catch (e) {
      console.error(e);
    }
  };

  // --- ESCUCHA EN VIVO COMPARTIDA PARA EL PARTIDO EN CURSO ---
  useEffect(() => {
    if (!idPartido || !usuario) return;
    const desuscribir = onSnapshot(
      doc(db, "partidos_club", idPartido),
      (docSnap) => {
        if (docSnap.exists()) {
          const datos = docSnap.data();
          if (datos.estadisticas) {
            setEstadisticas((prev: any) => {
              const nuevo = { ...prev };
              Object.keys(nuevo).forEach((q) => {
                if (datos.estadisticas[q])
                  nuevo[q] = { ...nuevo[q], ...datos.estadisticas[q] };
              });
              return nuevo;
            });
          }
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
      estadisticas,
    });
    setPartidoIniciado(true);
  };

  const manejarSuma = async (evento: string) => {
    if (!usuario) return;
    try {
      await updateDoc(doc(db, "partidos_club", idPartido), {
        [`estadisticas.${cuartoActual}.${evento}`]: increment(1),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const manejarResta = async (evento: string) => {
    if (!usuario || estadisticas[cuartoActual][evento] <= 0) return;
    try {
      await updateDoc(doc(db, "partidos_club", idPartido), {
        [`estadisticas.${cuartoActual}.${evento}`]: increment(-1),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const finalizarPartido = () => {
    const seguro = window.confirm(
      "¿Estás seguro de que querés salir del partido? Los datos ya quedaron guardados en Firebase."
    );
    if (seguro && perfilUsuario) {
      setCorriendo(false);
      setSegundos(0);
      setPartidoIniciado(false);
      setIdPartido("");
      setRival("");
      setCancha("");
      setTitulares([]);
      setSuplentes([]);
      resetearEstadisticasCompletas();
      cargarDatosClub(perfilUsuario);
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
    setVistaHistorial(false);
    setPartidoHistorialSeleccionado(null);
    setPartidoIniciado(true);
  };

  const eliminarPartidoHistorial = async (idPart: string) => {
    if (!perfilUsuario) return;
    const seguro = window.confirm(
      "¿Estás seguro de que querés ELIMINAR este partido del club definitivamente? Esta acción no se puede deshacer."
    );
    if (!seguro) return;
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

  const calcularTotal = (campo: string) => {
    if (!estadisticas) return 0;
    return (
      estadisticas["1Q"][campo] +
      estadisticas["2Q"][campo] +
      estadisticas["3Q"][campo] +
      estadisticas["4Q"][campo]
    );
  };

  const formatearTiempo = (totSegundos: number) => {
    const min = Math.floor(totSegundos / 60);
    const seg = totSegundos % 60;
    return `${min.toString().padStart(2, "0")}:${seg
      .toString()
      .padStart(2, "0")}`;
  };

  const exportarAExcel = async (partidoEspecifico: any = null) => {
    const r = partidoEspecifico ? partidoEspecifico.rival : rival;
    const f = partidoEspecifico ? partidoEspecifico.fecha : fecha;
    const c = partidoEspecifico ? partidoEspecifico.cancha : cancha;
    const tits = partidoEspecifico
      ? partidoEspecifico.titulares || []
      : titulares;
    const sups = partidoEspecifico
      ? partidoEspecifico.suplentes || []
      : suplentes;
    const ests = partidoEspecifico
      ? partidoEspecifico.estadisticas
      : estadisticas;

    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Planilla de Juego");
      worksheet.columns = [
        { width: 24 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
      ];
      const fontNegrita = { name: "Calibri", bold: true, size: 11 };
      const fontNormal = { name: "Calibri", size: 11 };
      const borderFino = {
        top: { style: "thin" as any },
        left: { style: "thin" as any },
        bottom: { style: "thin" as any },
        right: { style: "thin" as any },
      };
      const fillGrisEncabezado = {
        type: "pattern" as any,
        pattern: "solid" as any,
        fgColor: { argb: "FFEFEFEF" },
      };
      const fillAzulTotal = {
        type: "pattern" as any,
        pattern: "solid" as any,
        fgColor: { argb: "FFDBEAFE" },
      };

      worksheet.mergeCells("A2:G2");
      worksheet.getCell("A2").value =
        "PLANILLA DE ANÁLISIS DE PARTIDO – HOCKEY";
      worksheet.getCell("A2").font = { name: "Calibri", bold: true, size: 14 };
      worksheet.getCell("A2").alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      worksheet.getCell("A3").value = "Club:";
      worksheet.getCell("A3").font = fontNegrita;
      worksheet.getCell("B3").value = "Talleres de Paraná";
      worksheet.getCell("B3").font = fontNormal;
      worksheet.getCell("C3").value = "Rival:";
      worksheet.getCell("C3").font = fontNegrita;
      worksheet.getCell("D3").value = r;
      worksheet.getCell("D3").font = fontNormal;
      worksheet.getCell("E3").value = "Fecha:";
      worksheet.getCell("E3").font = fontNegrita;
      worksheet.getCell("F3").value = f;
      worksheet.getCell("F3").font = fontNormal;
      worksheet.getCell("A4").value = "Cancha:";
      worksheet.getCell("A4").font = fontNegrita;
      worksheet.getCell("B4").value = c || "No definida";
      worksheet.getCell("B4").font = fontNormal;

      worksheet.getCell("A5").value = "Titulares";
      worksheet.getCell("A5").font = fontNegrita;
      worksheet.getCell("C5").value = "Suplentes";
      worksheet.getCell("C5").font = fontNegrita;

      const maxJugadoras = Math.max(tits.length, sups.length, 11);
      for (let i = 0; i < maxJugadoras; i++) {
        const filaJ = 6 + i;
        worksheet.getCell(`A${filaJ}`).value = tits[i] || "";
        worksheet.getCell(`A${filaJ}`).font = fontNormal;
        worksheet.getCell(`A${filaJ}`).border = borderFino;
        worksheet.getCell(`C${filaJ}`).value = sups[i] || "";
        worksheet.getCell(`C${filaJ}`).font = fontNormal;
        worksheet.getCell(`C${filaJ}`).border = borderFino;
      }

      const filaTabla = 21;
      const encabezados = [
        "Cuarto",
        "Ingresos área rival",
        "Tiros",
        "Pérdidas",
        "Cortos a favor",
        "Cortos en contra",
        "Goles",
      ];
      encabezados.forEach((text, idx) => {
        const cell = worksheet.getCell(filaTabla, idx + 1);
        cell.value = text;
        cell.font = fontNegrita;
        cell.fill = fillGrisEncabezado;
        cell.border = borderFino;
        cell.alignment = { horizontal: "center" };
      });

      const cuartosKeys = ["1Q", "2Q", "3Q", "4Q"];
      const cuartosEtiquetas = ["1°", "2°", "3°", "4°"];
      cuartosKeys.forEach((qKey, qIdx) => {
        const fActual = filaTabla + 1 + qIdx;
        worksheet.getCell(fActual, 1).value = cuartosEtiquetas[qIdx];
        worksheet.getCell(fActual, 1).font = fontNegrita;
        worksheet.getCell(fActual, 1).alignment = { horizontal: "center" };
        worksheet.getCell(fActual, 2).value =
          ests[qKey]?.ingresos_area_favor || 0;
        worksheet.getCell(fActual, 3).value = ests[qKey]?.tiros_favor || 0;
        worksheet.getCell(fActual, 4).value = ests[qKey]?.perdidas || 0;
        worksheet.getCell(fActual, 5).value = ests[qKey]?.cortos_favor || 0;
        worksheet.getCell(fActual, 6).value = ests[qKey]?.cortos_contra || 0;
        worksheet.getCell(fActual, 7).value = ests[qKey]?.goles_favor || 0;
        for (let col = 1; col <= 7; col++) {
          const c = worksheet.getCell(fActual, col);
          if (col > 1) c.font = fontNormal;
          c.border = borderFino;
          c.alignment = { horizontal: "center" };
        }
      });

      const filaTotales = filaTabla + 5;
      worksheet.getCell(filaTotales, 1).value = "TOTALES";
      worksheet.getCell(filaTotales, 1).font = fontNegrita;
      worksheet.getCell(filaTotales, 1).border = borderFino;
      worksheet.getCell(filaTotales, 1).fill = fillAzulTotal;
      worksheet.getCell(filaTotales, 1).alignment = { horizontal: "center" };
      ["B", "C", "D", "E", "F", "G"].forEach((letra) => {
        const cellT = worksheet.getCell(`${letra}${filaTotales}`);
        cellT.value = {
          formula: `=SUM(${letra}${filaTabla + 1}:${letra}${filaTabla + 4})`,
        };
        cellT.font = fontNegrita;
        cellT.border = borderFino;
        cellT.fill = fillAzulTotal;
        cellT.alignment = { horizontal: "center" };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Planilla_${f}_vs_${r.replace(/ /g, "_")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const estiloInput: React.CSSProperties = {
    width: "100%",
    padding: "10px",
    borderRadius: "6px",
    backgroundColor: "#374151",
    border: "1px solid #4b5563",
    color: "white",
    boxSizing: "border-box",
  };
  const estiloBotonBase: React.CSSProperties = {
    padding: "24px 10px",
    borderRadius: "12px",
    fontWeight: "bold",
    fontSize: "18px",
    border: "none",
    color: "white",
    cursor: "pointer",
    width: "100%",
    userSelect: "none",
    WebkitUserSelect: "none",
  };
  const estiloCeldaTh: React.CSSProperties = {
    border: "1px solid #4b5563",
    padding: "12px",
    backgroundColor: "#1f2937",
    color: "#f3f4f6",
  };
  const estiloCeldaTd: React.CSSProperties = {
    border: "1px solid #374151",
    padding: "12px",
    textAlign: "center",
  };

  const ComponenteBotonInteligente = ({
    etiqueta,
    campo,
    colorFondo,
  }: {
    etiqueta: string;
    campo: string;
    colorFondo: string;
  }) => {
    const tiempoInicioRef = useRef<number>(0);
    const yaRostoRef = useRef<boolean>(false);
    const timerRestaRef = useRef<any>(null);

    const presionarBoton = (e: any) => {
      if (e.type === "touchstart") e.preventDefault();
      tiempoInicioRef.current = Date.now();
      yaRostoRef.current = false;

      timerRestaRef.current = setTimeout(() => {
        manejarResta(campo);
        yaRostoRef.current = true;
        if (navigator.vibrate) navigator.vibrate(50);
      }, 450);
    };

    const soltarBoton = (e: any) => {
      if (e.type === "touchend") e.preventDefault();
      clearTimeout(timerRestaRef.current);
      const duracionClick = Date.now() - tiempoInicioRef.current;

      if (duracionClick < 400 && !yaRostoRef.current) {
        manejarSuma(campo);
      }
    };

    return (
      <button
        onMouseDown={presionarBoton}
        onMouseUp={soltarBoton}
        onTouchStart={presionarBoton}
        onTouchEnd={soltarBoton}
        style={{ ...estiloBotonBase, backgroundColor: colorFondo }}
      >
        {etiqueta}
        <div style={{ fontSize: "24px", marginTop: "4px" }}>
          {estadisticas ? estadisticas[cuartoActual][campo] : 0}
        </div>
      </button>
    );
  };

  // PANTALLA DE CARGA INICIAL
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
          fontFamily: "sans-serif",
        }}
      >
        <h2>🔄 Cargando Sistema de Hockey del Club...</h2>
      </div>
    );
  }

  // --- INTERFAZ VISUAL 1: LOGIN / REGISTRO ---
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
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            maxWidth: "400px",
            width: "100%",
            backgroundColor: "#1f2937",
            padding: "28px",
            borderRadius: "12px",
            border: "1px solid #374151",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              color: "#60a5fa",
              marginTop: 0,
              marginBottom: "6px",
            }}
          >
            🏑 CONTROL DE ESTADÍSTICAS
          </h2>
          <p
            style={{
              textAlign: "center",
              color: "#9ca3af",
              fontSize: "14px",
              marginTop: 0,
              marginBottom: "24px",
            }}
          >
            Acceso exclusivo para Cuerpos Técnicos
          </p>

          <form
            onSubmit={manejarAuth}
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "14px",
                }}
              >
                Correo Electrónico:
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dt@talleres.com"
                style={estiloInput as any}
                required
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "14px",
                }}
              >
                Contraseña:
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
                  fontSize: "14px",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                ⚠️ {errorAuth}
              </div>
            )}

            <button
              type="submit"
              style={{
                marginTop: "8px",
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#2563eb",
                color: "white",
                fontWeight: "bold",
                fontSize: "16px",
                cursor: "pointer",
              }}
            >
              {esRegistro ? "🚀 Registrar Nuevo Técnico" : "🔑 Iniciar Sesión"}
            </button>
          </form>

          <div
            style={{ textAlign: "center", marginTop: "18px", fontSize: "14px" }}
          >
            <span style={{ color: "#9ca3af" }}>
              {esRegistro ? "¿Ya tenés cuenta?" : "¿Sos un técnico nuevo?"}
            </span>{" "}
            <button
              onClick={() => {
                setEsRegistro(!esRegistro);
                setErrorAuth("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#60a5fa",
                cursor: "pointer",
                fontWeight: "bold",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              {esRegistro ? "Iniciá Sesión acá" : "Registrate acá"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- INTERFAZ VISUAL 2: MODO JUEGO OFICIAL (LOGUEADO) ---
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
          🏃‍♂️ Rol:{" "}
          <b style={{ color: "#60a5fa" }}>
            {perfilUsuario?.rol?.toUpperCase()}
          </b>{" "}
          ({usuario.email})
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
            fontWeight: "bold",
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
              {modoAdmin ? "❌ Cerrar Panel" : "⚙️ Plantel / Jugadoras"}
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
              {vistaHistorial ? "❌ Cerrar Historial" : "📂 Historial Partidos"}
            </button>
          </div>

          {vistaHistorial && (
            <div
              style={{
                backgroundColor: "#1e293b",
                padding: "20px",
                borderRadius: "12px",
                border: "2px solid #0284c7",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <h3
                style={{ marginTop: 0, color: "#38bdf8", textAlign: "center" }}
              >
                📁 PANEL DE HISTORIAL (
                {perfilUsuario?.rol === "coordinador"
                  ? "GLOBAL DEL CLUB"
                  : "MIS CATEGORÍAS"}
                )
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
                  {listaPartidosViejos.filter(
                    (p) => p.id_categoria === equipoSeleccionado
                  ).length === 0 ? (
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#94a3b8",
                        textAlign: "center",
                      }}
                    >
                      No hay partidos registrados para esta categoría todavía.
                    </div>
                  ) : (
                    listaPartidosViejos
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
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>
                            📅 {p.fecha} - <b>vs {p.rival}</b>
                          </span>
                          <span style={{ color: "#38bdf8", fontSize: "13px" }}>
                            Ver planilla ➡️
                          </span>
                        </button>
                      ))
                  )}
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "12px",
                      flexWrap: "wrap",
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
                        cursor: "pointer",
                        fontSize: "13px",
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
                          cursor: "pointer",
                          fontSize: "13px",
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
                          cursor: "pointer",
                          fontSize: "13px",
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
                          cursor: "pointer",
                          fontSize: "13px",
                        }}
                      >
                        🗑️ Borrar
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: "#0f172a",
                      padding: "12px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      marginBottom: "12px",
                      border: "1px solid #334155",
                    }}
                  >
                    <div>
                      📌 <b>Rival:</b> {partidoHistorialSeleccionado.rival}
                    </div>
                    <div>
                      🏟️ <b>Cancha:</b>{" "}
                      {partidoHistorialSeleccionado.cancha || "No definida"}
                    </div>
                    <div>
                      📋 <b>Categoría:</b>{" "}
                      {partidoHistorialSeleccionado.categoria || "No definida"}
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
                      <thead>
                        <tr>
                          <th
                            style={{
                              border: "1px solid #334155",
                              padding: "6px",
                              backgroundColor: "#1e293b",
                            }}
                          >
                            Métrica
                          </th>
                          <th
                            style={{
                              border: "1px solid #334155",
                              padding: "6px",
                              backgroundColor: "#1e293b",
                            }}
                          >
                            1Q
                          </th>
                          <th
                            style={{
                              border: "1px solid #334155",
                              padding: "6px",
                              backgroundColor: "#1e293b",
                            }}
                          >
                            2Q
                          </th>
                          <th
                            style={{
                              border: "1px solid #334155",
                              padding: "6px",
                              backgroundColor: "#1e293b",
                            }}
                          >
                            3Q
                          </th>
                          <th
                            style={{
                              border: "1px solid #334155",
                              padding: "6px",
                              backgroundColor: "#1e293b",
                            }}
                          >
                            4Q
                          </th>
                          <th
                            style={{
                              border: "1px solid #334155",
                              padding: "6px",
                              backgroundColor: "#2563eb",
                            }}
                          >
                            TOT
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {
                            label: "Ing. Área Fav.",
                            key: "ingresos_area_favor",
                          },
                          {
                            label: "Ing. Área Cont.",
                            key: "ingresos_area_contra",
                          },
                          { label: "Tiros Fav.", key: "tiros_favor" },
                          { label: "Tiros Cont.", key: "tiros_contra" },
                          { label: "Cortos Fav.", key: "cortos_favor" },
                          { label: "Cortos Cont.", key: "cortos_contra" },
                          { label: "Pérdidas", key: "perdidas" },
                          { label: "Recuperac.", key: "recuperaciones" },
                          { label: "Goles Fav.", key: "goles_favor" },
                          { label: "Goles Cont.", key: "goles_contra" },
                        ].map((row) => {
                          const q1 =
                            partidoHistorialSeleccionado.estadisticas?.["1Q"]?.[
                              row.key
                            ] || 0;
                          const q2 =
                            partidoHistorialSeleccionado.estadisticas?.["2Q"]?.[
                              row.key
                            ] || 0;
                          const q3 =
                            partidoHistorialSeleccionado.estadisticas?.["3Q"]?.[
                              row.key
                            ] || 0;
                          const q4 =
                            partidoHistorialSeleccionado.estadisticas?.["4Q"]?.[
                              row.key
                            ] || 0;
                          return (
                            <tr key={row.key}>
                              <td
                                style={{
                                  border: "1px solid #334155",
                                  padding: "6px",
                                  fontWeight: "bold",
                                }}
                              >
                                {row.label}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #334155",
                                  padding: "6px",
                                  textAlign: "center",
                                }}
                              >
                                {q1}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #334155",
                                  padding: "6px",
                                  textAlign: "center",
                                }}
                              >
                                {q2}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #334155",
                                  padding: "6px",
                                  textAlign: "center",
                                }}
                              >
                                {q3}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #334155",
                                  padding: "6px",
                                  textAlign: "center",
                                }}
                              >
                                {q4}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #334155",
                                  padding: "6px",
                                  textAlign: "center",
                                  fontWeight: "bold",
                                  backgroundColor: "#1e3a8a",
                                }}
                              >
                                {q1 + q2 + q3 + q4}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {modoAdmin && (
            <div
              style={{
                backgroundColor: "#1e293b",
                padding: "20px",
                borderRadius: "12px",
                border: "2px dashed #4f46e5",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#818cf8" }}>
                ⚙️ CONFIGURACIÓN DE PLANTEL
              </h3>

              {perfilUsuario?.rol === "coordinador" ? (
                <form
                  onSubmit={crearNuevoEquipo}
                  style={{
                    display: "flex",
                    gap: "8px",
                    borderBottom: "1px solid #374151",
                    paddingBottom: "12px",
                  }}
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
                      padding: "10px 16px",
                      backgroundColor: "#10b981",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    + Crear Categoría
                  </button>
                </form>
              ) : (
                <div
                  style={{
                    fontSize: "13px",
                    color: "#94a3b8",
                    backgroundColor: "#111827",
                    padding: "8px",
                    borderRadius: "6px",
                  }}
                >
                  📌 Solo el Coordinador puede dar de alta nuevas categorías
                  globales.
                </div>
              )}

              {listaEquipos.length > 0 && (
                <>
                  <form
                    onSubmit={agregarJugadorasAlEquipo}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <label style={{ fontSize: "13px", color: "#94a3b8" }}>
                      Sumar jugadoras a (
                      <b>
                        {listaEquipos.find((e) => e.id === equipoSeleccionado)
                          ?.nombre || "Ninguna"}
                      </b>
                      ):
                    </label>
                    <textarea
                      value={nuevasJugadorasTexto}
                      onChange={(e) => setNuevasJugadorasTexto(e.target.value)}
                      placeholder="Delfina, Belen, Sofia, Agostina"
                      rows={2}
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
                        cursor: "pointer",
                      }}
                    >
                      ➕ Cargar Jugadoras
                    </button>
                  </form>

                  {equipoSeleccionado && jugadorasDelEquipo.length > 0 && (
                    <div style={{ marginTop: "4px" }}>
                      <label
                        style={{
                          fontSize: "13px",
                          color: "#a5b4fc",
                          display: "block",
                          marginBottom: "6px",
                        }}
                      >
                        Lista Actual del Plantel:
                      </label>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px",
                          maxHeight: "120px",
                          overflowY: "auto",
                          backgroundColor: "#111827",
                          padding: "8px",
                          borderRadius: "6px",
                        }}
                      >
                        {jugadorasDelEquipo.map((jug) => (
                          <span
                            key={jug}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              backgroundColor: "#374151",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "12px",
                            }}
                          >
                            {jug}
                            <button
                              type="button"
                              onClick={() => eliminarJugadoraIndividual(jug)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                fontWeight: "bold",
                                padding: 0,
                              }}
                            >
                              ❌
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div
            style={{
              backgroundColor: "#1f2937",
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid #374151",
            }}
          >
            <h2 style={{ textAlign: "center", color: "#60a5fa", marginTop: 0 }}>
              🏑 NUEVO PARTIDO
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
                    <option>No tenés categorías autorizadas para ver.</option>
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
                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "4px",
                          fontSize: "14px",
                        }}
                      >
                        Rival:
                      </label>
                      <input
                        type="text"
                        value={rival}
                        onChange={(e) => setRival(e.target.value)}
                        placeholder="Ej: Rowing"
                        style={estiloInput as any}
                        required
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "4px",
                          fontSize: "14px",
                        }}
                      >
                        Cancha:
                      </label>
                      <input
                        type="text"
                        value={cancha}
                        onChange={(e) => setCancha(e.target.value)}
                        placeholder="Ej: Agua"
                        style={estiloInput as any}
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "4px",
                        fontSize: "14px",
                      }}
                    >
                      Fecha:
                    </label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      style={estiloInput as any}
                    />
                  </div>

                  <h3
                    style={{
                      borderBottom: "1px solid #374151",
                      paddingBottom: "6px",
                      color: "#9ca3af",
                      marginBottom: "4px",
                    }}
                  >
                    📋 Lista de Jugadoras ({titulares.length} Tit. /{" "}
                    {suplentes.length} Sup.)
                  </h3>
                  <div
                    style={{
                      maxHeight: "200px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {jugadorasDelEquipo.length === 0 ? (
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#9ca3af",
                          textAlign: "center",
                          padding: "10px",
                        }}
                      >
                        Este plantel no tiene jugadoras cargadas. Cargalas
                        arriba en Plantel.
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
                              padding: "8px",
                              borderRadius: "6px",
                            }}
                          >
                            <span style={{ fontSize: "14px" }}>{j}</span>
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
                                  fontSize: "12px",
                                }}
                              >
                                Titular
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
                                  fontSize: "12px",
                                }}
                              >
                                Suplente
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
                      marginTop: "10px",
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
                    🚀 INICIAR ANALISIS EN VIVO
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      ) : (
        /* ---------------- MODO JUEGO COLABORATIVO ---------------- */
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              marginBottom: "20px",
              paddingBottom: "10px",
              borderBottom: "1px solid #374151",
            }}
          >
            <button
              onClick={finalizarPartido}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: "bold",
                backgroundColor: "#dc2626",
                color: "white",
              }}
            >
              🚩 Cerrar Mesa de Control
            </button>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setVista("telefono")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold",
                  backgroundColor: vista === "telefono" ? "#6366f1" : "#374151",
                  color: "white",
                }}
              >
                📲 Celular
              </button>
              <button
                onClick={() => setVista("computadora")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold",
                  backgroundColor:
                    vista === "computadora" ? "#6366f1" : "#374151",
                  color: "white",
                }}
              >
                💻 Computadora
              </button>
            </div>
          </div>

          {vista === "telefono" && estadisticas && (
            <div
              style={{
                maxWidth: "450px",
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#1f2937",
                  padding: "16px",
                  borderRadius: "12px",
                  textAlign: "center",
                  border: "1px solid #374151",
                }}
              >
                <div
                  style={{
                    fontSize: "48px",
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    color: "#10b981",
                  }}
                >
                  {formatearTiempo(segundos)}
                </div>
                <div
                  style={{ display: "flex", gap: "10px", marginTop: "10px" }}
                >
                  <button
                    onClick={() => setCorriendo(!corriendo)}
                    style={{
                      flex: 2,
                      padding: "12px",
                      borderRadius: "8px",
                      border: "none",
                      fontWeight: "bold",
                      cursor: "pointer",
                      backgroundColor: corriendo ? "#e11d48" : "#2563eb",
                      color: "white",
                    }}
                  >
                    {corriendo ? "⏸️ PAUSAR" : "▶️ REANUDAR"}
                  </button>
                  <button
                    onClick={() => setSegundos(0)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: "8px",
                      border: "none",
                      fontWeight: "bold",
                      cursor: "pointer",
                      backgroundColor: "#4b5563",
                      color: "white",
                    }}
                  >
                    🔄 Reiniciar
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "8px",
                  backgroundColor: "#1f2937",
                  padding: "8px",
                  borderRadius: "8px",
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
                      padding: "10px 0",
                      fontWeight: "bold",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
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
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <ComponenteBotonInteligente
                    etiqueta="Área Favor"
                    campo="ingresos_area_favor"
                    colorFondo="#15803d"
                  />
                  <ComponenteBotonInteligente
                    etiqueta="Área Contra"
                    campo="ingresos_area_contra"
                    colorFondo="#b91c1c"
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <ComponenteBotonInteligente
                    etiqueta="Tiro Favor"
                    campo="tiros_favor"
                    colorFondo="#166534"
                  />
                  <ComponenteBotonInteligente
                    etiqueta="Tiro Contra"
                    campo="tiros_contra"
                    colorFondo="#991b1b"
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <ComponenteBotonInteligente
                    etiqueta="Corto Favor"
                    campo="cortos_favor"
                    colorFondo="#059669"
                  />
                  <ComponenteBotonInteligente
                    etiqueta="Corto Contra"
                    campo="cortos_contra"
                    colorFondo="#e11d48"
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <ComponenteBotonInteligente
                    etiqueta="Pérdida"
                    campo="perdidas"
                    colorFondo="#b45309"
                  />
                  <ComponenteBotonInteligente
                    etiqueta="Recuperación"
                    campo="recuperaciones"
                    colorFondo="#4338ca"
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <ComponenteBotonInteligente
                    etiqueta="¡Gol Favor!"
                    campo="goles_favor"
                    colorFondo="#22c55e"
                  />
                  <ComponenteBotonInteligente
                    etiqueta="Gol Contra"
                    campo="goles_contra"
                    colorFondo="#ef4444"
                  />
                </div>
              </div>
              <p
                style={{
                  textTransform: "uppercase",
                  fontSize: "11px",
                  textAlign: "center",
                  color: "#94a3b8",
                  margin: 0,
                }}
              >
                💡 Tip: Si otro profe suma un evento en su celular, impactará
                acá al instante.
              </p>
            </div>
          )}

          {vista === "computadora" && estadisticas && (
            <div style={{ maxWidth: "950px", margin: "0 auto" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: "14px",
                }}
              >
                <button
                  onClick={() => exportarAExcel(null)}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: "#16a34a",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "bold",
                    fontSize: "16px",
                    cursor: "pointer",
                  }}
                >
                  📥 Exportar a Excel (.xlsx)
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1.5fr 1.5fr 1fr 1fr",
                  gap: "10px",
                  backgroundColor: "#1f2937",
                  padding: "16px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  border: "1px solid #374151",
                  fontSize: "14px",
                }}
              >
                <div>
                  <strong>Club:</strong> Talleres de Paraná
                </div>
                <div>
                  <strong>Categoría:</strong>{" "}
                  {
                    listaEquipos.find((e) => e.id === equipoSeleccionado)
                      ?.nombre
                  }
                </div>
                <div>
                  <strong>Rival:</strong> {rival}
                </div>
                <div>
                  <strong>Fecha:</strong> {fecha}
                </div>
                <div>
                  <strong>Cancha:</strong> {cancha || "No definida"}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#1f2937",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  <strong style={{ color: "#10b981" }}>Titulares:</strong>{" "}
                  {titulares.join(", ") || "Ninguno asignado"}
                </div>
                <div
                  style={{
                    backgroundColor: "#1f2937",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  <strong style={{ color: "#f59e0b" }}>Suplentes:</strong>{" "}
                  {suplentes.join(", ") || "Ninguno asignado"}
                </div>
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
                    <th style={estiloCeldaTh as any}>Métrica / Evento</th>
                    <th style={estiloCeldaTh as any}>1° Cuarto</th>
                    <th style={estiloCeldaTh as any}>2° Cuarto</th>
                    <th style={estiloCeldaTh as any}>3° Cuarto</th>
                    <th style={estiloCeldaTh as any}>4° Cuarto</th>
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
                  {[
                    {
                      label: "Ingresos Área Rival",
                      key: "ingresos_area_favor",
                    },
                    {
                      label: "Ingresos Área Propia",
                      key: "ingresos_area_contra",
                    },
                    { label: "Tiros al Arco a Favor", key: "tiros_favor" },
                    { label: "Tiros al Arco en Contra", key: "tiros_contra" },
                    { label: "Cortos a Favor", key: "cortos_favor" },
                    { label: "Cortos en Contra", key: "cortos_contra" },
                    { label: "Pérdidas", key: "perdidas" },
                    { label: "Recuperaciones", key: "recuperaciones" },
                  ].map((row) => (
                    <tr key={row.key}>
                      <td
                        style={
                          {
                            ...estiloCeldaTd,
                            textAlign: "left",
                            fontWeight: "bold",
                          } as any
                        }
                      >
                        {row.label}
                      </td>
                      <td style={estiloCeldaTd as any}>
                        {estadisticas["1Q"][row.key]}
                      </td>
                      <td style={estiloCeldaTd as any}>
                        {estadisticas["2Q"][row.key]}
                      </td>
                      <td style={estiloCeldaTd as any}>
                        {estadisticas["3Q"][row.key]}
                      </td>
                      <td style={estiloCeldaTd as any}>
                        {estadisticas["4Q"][row.key]}
                      </td>
                      <td
                        style={
                          {
                            ...estiloCeldaTd,
                            fontWeight: "bold",
                            backgroundColor: "#1e3a8a",
                          } as any
                        }
                      >
                        {calcularTotal(row.key)}
                      </td>
                    </tr>
                  ))}
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
                      Goles a Favor
                    </td>
                    <td style={estiloCeldaTd as any}>
                      {estadisticas["1Q"].goles_favor}
                    </td>
                    <td style={estiloCeldaTd as any}>
                      {estadisticas["2Q"].goles_favor}
                    </td>
                    <td style={estiloCeldaTd as any}>
                      {estadisticas["3Q"].goles_favor}
                    </td>
                    <td style={estiloCeldaTd as any}>
                      {estadisticas["4Q"].goles_favor}
                    </td>
                    <td
                      style={
                        {
                          ...estiloCeldaTd,
                          fontWeight: "black",
                          backgroundColor: "#047857",
                        } as any
                      }
                    >
                      {calcularTotal("goles_favor")}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: "#991b1b" }}>
                    <td
                      style={
                        {
                          ...estiloCeldaTd,
                          textAlign: "left",
                          fontWeight: "bold",
                        } as any
                      }
                    >
                      Goles en Contra
                    </td>
                    <td style={estiloCeldaTd as any}>
                      {estadisticas["1Q"].goles_contra}
                    </td>
                    <td style={estiloCeldaTd as any}>
                      {estadisticas["2Q"].goles_contra}
                    </td>
                    <td style={estiloCeldaTd as any}>
                      {estadisticas["3Q"].goles_contra}
                    </td>
                    <td style={estiloCeldaTd as any}>
                      {estadisticas["4Q"].goles_contra}
                    </td>
                    <td
                      style={
                        {
                          ...estiloCeldaTd,
                          fontWeight: "black",
                          backgroundColor: "#b91c1c",
                        } as any
                      }
                    >
                      {calcularTotal("goles_contra")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
