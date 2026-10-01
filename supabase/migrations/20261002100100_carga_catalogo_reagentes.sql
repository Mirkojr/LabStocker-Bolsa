-- ============================================================
-- CARGA INICIAL DO CATÁLOGO DE REAGENTES (276 reagentes)
-- ------------------------------------------------------------
-- Gerada por scripts/catalogo/gerar-migration.mjs a partir de
-- scripts/catalogo/catalogo-conferido.csv. Não edite à mão: corrija a
-- lista e gere de novo.
--
-- CAS e fórmula conferidos no PubChem; órgão controlador tirado da
-- Portaria MJSP 204/2022 (Polícia Federal, Listas I a VI) e da
-- Portaria 118-COLOG/2019 (Exército, produtos químicos).
--
-- Não apaga nem renomeia nada. Reagente que já existe com o mesmo nome
-- (ignorando caixa e espaços) ganha o CAS, e a fórmula e o controle só
-- quando estiverem vazios. Os demais são inseridos, a não ser que o CAS
-- já esteja no catálogo com outro nome.
-- ============================================================

CREATE TEMP TABLE carga_catalogo (
  nome text NOT NULL,
  numero_cas text,
  formula text,
  controle text
) ON COMMIT DROP;

INSERT INTO carga_catalogo (nome, numero_cas, formula, controle) VALUES
  ('Ácido acético', '64-19-7', 'CH3COOH', 'Polícia Federal'),
  ('Ácido acetilsalicílico', '50-78-2', 'C9H8O4', NULL),
  ('Ácido ascórbico', '50-81-7', 'C6H8O6', NULL),
  ('Ácido benzoico', '65-85-0', 'C6H5COOH', 'Polícia Federal'),
  ('Ácido bórico', '10043-35-3', 'H3BO3', 'Polícia Federal'),
  ('Ácido bromídrico', '10035-10-6', 'HBr', 'Polícia Federal'),
  ('Ácido cítrico', '77-92-9', 'C6H8O7', NULL),
  ('Ácido cítrico monoidratado', '5949-29-1', 'C6H8O7·H2O', NULL),
  ('Ácido clorídrico', '7647-01-0', 'HCl', 'Polícia Federal'),
  ('Ácido 3,5-dinitrossalicílico', '609-99-4', 'C7H4N2O7', NULL),
  ('Ácido esteárico', '57-11-4', 'C18H36O2', NULL),
  ('Ácido etilenodiaminotetracético (EDTA)', '60-00-4', 'C10H16N2O8', NULL),
  ('Ácido fluorídrico', '7664-39-3', 'HF', 'Exército'),
  ('Ácido fórmico', '64-18-6', 'HCOOH', 'Polícia Federal'),
  ('Ácido fosfórico', '7664-38-2', 'H3PO4', NULL),
  ('Ácido ftálico', '88-99-3', 'C8H6O4', NULL),
  ('Ácido gálico', '149-91-7', 'C7H6O5', NULL),
  ('Ácido iodídrico', '10034-85-2', 'HI', 'Polícia Federal'),
  ('Ácido láctico', '50-21-5', 'C3H6O3', NULL),
  ('Ácido L-glutâmico', '56-86-0', 'C5H9NO4', NULL),
  ('Ácido maleico', '110-16-7', 'C4H4O4', NULL),
  ('Ácido nítrico', '7697-37-2', 'HNO3', 'Exército'),
  ('Ácido oleico', '112-80-1', 'C18H34O2', NULL),
  ('Ácido oxálico', '144-62-7', 'C2H2O4', NULL),
  ('Ácido oxálico di-hidratado', '6153-56-6', 'C2H2O4·2H2O', NULL),
  ('Ácido perclórico', '7601-90-3', 'HClO4', 'Exército'),
  ('Ácido p-toluenossulfônico monoidratado', '6192-52-5', 'C7H8O3S·H2O', NULL),
  ('Ácido salicílico', '69-72-7', 'C7H6O3', NULL),
  ('Ácido succínico', '110-15-6', 'C4H6O4', NULL),
  ('Ácido sulfâmico', '5329-14-6', 'H3NSO3', NULL),
  ('Ácido sulfanílico', '121-57-3', 'C6H7NO3S', NULL),
  ('Ácido sulfúrico', '7664-93-9', 'H2SO4', 'Polícia Federal'),
  ('Ácido tartárico', '87-69-4', 'C4H6O6', NULL),
  ('Ácido tricloroacético', '76-03-9', 'C2HCl3O2', NULL),
  ('Ácido trifluoroacético', '76-05-1', 'C2HF3O2', NULL),
  ('Acetaldeído', '75-07-0', 'C2H4O', NULL),
  ('Acetato de amônio', '631-61-8', 'CH3COONH4', NULL),
  ('Acetato de butila', '123-86-4', 'C6H12O2', NULL),
  ('Acetato de chumbo(II) tri-hidratado', '6080-56-4', 'Pb(CH3COO)2·3H2O', NULL),
  ('Acetato de cobre(II) monoidratado', '6046-93-1', 'Cu(CH3COO)2·H2O', NULL),
  ('Acetato de etila', '141-78-6', 'C4H8O2', 'Polícia Federal'),
  ('Acetato de isoamila', '123-92-2', 'C7H14O2', NULL),
  ('Acetato de potássio', '127-08-2', 'CH3COOK', NULL),
  ('Acetato de sódio', '127-09-3', 'CH3COONa', NULL),
  ('Acetato de sódio tri-hidratado', '6131-90-4', 'CH3COONa·3H2O', NULL),
  ('Acetato de zinco di-hidratado', '5970-45-6', 'Zn(CH3COO)2·2H2O', NULL),
  ('Acetona', '67-64-1', 'C3H6O', 'Polícia Federal'),
  ('Acetonitrila', '75-05-8', 'CH3CN', NULL),
  ('Acrilamida', '79-06-1', 'C3H5NO', NULL),
  ('Água oxigenada (peróxido de hidrogênio)', '7722-84-1', 'H2O2', NULL),
  ('Alaranjado de metila', '547-58-0', 'C14H14N3NaO3S', NULL),
  ('Álcool isoamílico', '123-51-3', 'C5H12O', NULL),
  ('Alúmen de potássio', '7784-24-9', 'KAl(SO4)2·12H2O', NULL),
  ('Alumínio em pó', '7429-90-5', 'Al', 'Exército'),
  ('Anidrido acético', '108-24-7', 'C4H6O3', 'Polícia Federal'),
  ('Anilina', '62-53-3', 'C6H7N', NULL),
  ('Azida sódica', '26628-22-8', 'NaN3', 'Exército'),
  ('Azul de bromofenol', '115-39-9', 'C19H10Br4O5S', NULL),
  ('Azul de bromotimol', '76-59-5', 'C27H28Br2O5S', NULL),
  ('Azul de Coomassie R-250', '6104-59-2', 'C45H44N3NaO7S2', NULL),
  ('Azul de metileno', '61-73-4', 'C16H18ClN3S', NULL),
  ('Benzaldeído', '100-52-7', 'C7H6O', NULL),
  ('Benzeno', '71-43-2', 'C6H6', NULL),
  ('Benzoato de sódio', '532-32-1', 'C7H5NaO2', NULL),
  ('Bicarbonato de potássio', '298-14-6', 'KHCO3', 'Polícia Federal'),
  ('Bicarbonato de sódio', '144-55-8', 'NaHCO3', NULL),
  ('Biftalato de potássio', '877-24-7', 'C8H5KO4', NULL),
  ('Bórax (tetraborato de sódio decaidratado)', '1303-96-4', 'Na2B4O7·10H2O', NULL),
  ('Bromato de potássio', '7758-01-2', 'KBrO3', NULL),
  ('Brometo de etídio', '1239-45-8', 'C21H20BrN3', NULL),
  ('Brometo de potássio', '7758-02-3', 'KBr', NULL),
  ('Brometo de sódio', '7647-15-6', 'NaBr', NULL),
  ('Bromo', '7726-95-6', 'Br2', NULL),
  ('Bromobenzeno', '108-86-1', 'C6H5Br', 'Polícia Federal'),
  ('Borohidreto de sódio', '16940-66-2', 'NaBH4', 'Polícia Federal'),
  ('n-Butanol', '71-36-3', 'C4H10O', NULL),
  ('Cafeína', '58-08-2', 'C8H10N4O2', 'Polícia Federal'),
  ('Carbonato de cálcio', '471-34-1', 'CaCO3', NULL),
  ('Carbonato de lítio', '554-13-2', 'Li2CO3', NULL),
  ('Carbonato de potássio', '584-08-7', 'K2CO3', NULL),
  ('Carbonato de sódio', '497-19-8', 'Na2CO3', NULL),
  ('Carvão ativado', '7440-44-0', 'C', NULL),
  ('Cianeto de potássio', '151-50-8', 'KCN', 'Exército'),
  ('Cianeto de sódio', '143-33-9', 'NaCN', 'Exército'),
  ('Ciclo-hexano', '110-82-7', 'C6H12', NULL),
  ('Ciclo-hexanol', '108-93-0', 'C6H12O', NULL),
  ('Ciclo-hexanona', '108-94-1', 'C6H10O', NULL),
  ('Citrato de sódio di-hidratado', '6132-04-3', 'Na3C6H5O7·2H2O', NULL),
  ('Clorato de potássio', '3811-04-9', 'KClO3', 'Exército'),
  ('Cloreto de acetila', '75-36-5', 'C2H3ClO', NULL),
  ('Cloreto de alumínio', '7446-70-0', 'AlCl3', NULL),
  ('Cloreto de amônio', '12125-02-9', 'NH4Cl', 'Polícia Federal'),
  ('Cloreto de bário di-hidratado', '10326-27-9', 'BaCl2·2H2O', NULL),
  ('Cloreto de cálcio', '10043-52-4', 'CaCl2', NULL),
  ('Cloreto de cálcio di-hidratado', '10035-04-8', 'CaCl2·2H2O', NULL),
  ('Cloreto de cobalto(II) hexaidratado', '7791-13-1', 'CoCl2·6H2O', NULL),
  ('Cloreto de cobre(II) di-hidratado', '10125-13-0', 'CuCl2·2H2O', NULL),
  ('Cloreto de cromo(III) hexaidratado', '10060-12-5', 'CrCl3·6H2O', NULL),
  ('Cloreto de estanho(II) di-hidratado', '10025-69-1', 'SnCl2·2H2O', NULL),
  ('Cloreto de estrôncio hexaidratado', '10025-70-4', 'SrCl2·6H2O', NULL),
  ('Cloreto de ferro(III)', '7705-08-0', 'FeCl3', NULL),
  ('Cloreto de ferro(III) hexaidratado', '10025-77-1', 'FeCl3·6H2O', NULL),
  ('Cloreto de guanidina', '50-01-1', 'CH5N3·HCl', NULL),
  ('Cloreto de lítio', '7447-41-8', 'LiCl', NULL),
  ('Cloreto de magnésio hexaidratado', '7791-18-6', 'MgCl2·6H2O', NULL),
  ('Cloreto de manganês(II) tetraidratado', '13446-34-9', 'MnCl2·4H2O', NULL),
  ('Cloreto de mercúrio(II)', '7487-94-7', 'HgCl2', 'Polícia Federal'),
  ('Cloreto de níquel(II) hexaidratado', '7791-20-0', 'NiCl2·6H2O', NULL),
  ('Cloreto de potássio', '7447-40-7', 'KCl', NULL),
  ('Cloreto de sódio', '7647-14-5', 'NaCl', NULL),
  ('Cloreto de tionila', '7719-09-7', 'SOCl2', 'Exército'),
  ('Cloreto de zinco', '7646-85-7', 'ZnCl2', NULL),
  ('Cloridrato de hidroxilamina', '5470-11-1', 'NH2OH·HCl', 'Polícia Federal'),
  ('Clorofórmio', '67-66-3', 'CHCl3', 'Polícia Federal'),
  ('Cobre metálico', '7440-50-8', 'Cu', NULL),
  ('Colesterol', '57-88-5', 'C27H46O', NULL),
  ('Cristal violeta', '548-62-9', 'C25H30ClN3', NULL),
  ('Cromato de potássio', '7789-00-6', 'K2CrO4', 'Polícia Federal'),
  ('Diclorometano', '75-09-2', 'CH2Cl2', 'Polícia Federal'),
  ('1,2-Dicloroetano', '107-06-2', 'C2H4Cl2', 'Polícia Federal'),
  ('Dicromato de potássio', '7778-50-9', 'K2Cr2O7', 'Polícia Federal'),
  ('Dicromato de sódio di-hidratado', '7789-12-0', 'Na2Cr2O7·2H2O', 'Polícia Federal'),
  ('Dietilamina', '109-89-7', 'C4H11N', 'Polícia Federal'),
  ('Difenilamina', '122-39-4', 'C12H11N', NULL),
  ('1,5-Difenilcarbazida', '140-22-7', 'C13H14N4O', NULL),
  ('Dimetilglioxima', '95-45-4', 'C4H8N2O2', NULL),
  ('Dimetilsulfóxido (DMSO)', '67-68-5', 'C2H6OS', NULL),
  ('N,N-Dimetilformamida (DMF)', '68-12-2', 'C3H7NO', NULL),
  ('1,4-Dioxano', '123-91-1', 'C4H8O2', NULL),
  ('Dióxido de manganês', '1313-13-9', 'MnO2', NULL),
  ('Dióxido de titânio', '13463-67-7', 'TiO2', NULL),
  ('Dissulfeto de carbono', '75-15-0', 'CS2', NULL),
  ('Ditiotreitol (DTT)', '3483-12-3', 'C4H10O2S2', NULL),
  ('Dodecil sulfato de sódio (SDS)', '151-21-3', 'C12H25NaO4S', NULL),
  ('EDTA dissódico di-hidratado', '6381-92-6', 'C10H14N2Na2O8·2H2O', NULL),
  ('Enxofre', '7704-34-9', 'S', NULL),
  ('Eosina Y', '17372-87-1', 'C20H6Br4Na2O5', NULL),
  ('Éter etílico', '60-29-7', 'C4H10O', 'Polícia Federal'),
  ('Etanol', '64-17-5', 'C2H5OH', NULL),
  ('Etilenodiamina', '107-15-3', 'C2H8N2', NULL),
  ('Etilenoglicol', '107-21-1', 'C2H6O2', NULL),
  ('Fenol', '108-95-2', 'C6H5OH', NULL),
  ('Fenolftaleína', '77-09-8', 'C20H14O4', NULL),
  ('1,10-Fenantrolina monoidratada', '5144-89-8', 'C12H8N2·H2O', NULL),
  ('Ferricianeto de potássio', '13746-66-2', 'K3[Fe(CN)6]', NULL),
  ('Ferro em pó', '7439-89-6', 'Fe', NULL),
  ('Ferrocianeto de potássio tri-hidratado', '14459-95-1', 'K4[Fe(CN)6]·3H2O', NULL),
  ('Fluoreto de potássio', '7789-23-3', 'KF', 'Exército'),
  ('Fluoreto de sódio', '7681-49-4', 'NaF', 'Exército'),
  ('Formaldeído', '50-00-0', 'CH2O', NULL),
  ('Formamida', '75-12-7', 'CH3NO', 'Polícia Federal'),
  ('Formiato de amônio', '540-69-2', 'HCOONH4', 'Polícia Federal'),
  ('Fosfato de amônio dibásico', '7783-28-0', '(NH4)2HPO4', NULL),
  ('Fosfato de potássio dibásico', '7758-11-4', 'K2HPO4', NULL),
  ('Fosfato de potássio monobásico', '7778-77-0', 'KH2PO4', NULL),
  ('Fosfato de sódio dibásico', '7558-79-4', 'Na2HPO4', NULL),
  ('Fosfato de sódio monobásico monoidratado', '10049-21-5', 'NaH2PO4·H2O', NULL),
  ('Fosfato de sódio tribásico dodecaidratado', '10101-89-0', 'Na3PO4·12H2O', NULL),
  ('Frutose', '57-48-7', 'C6H12O6', NULL),
  ('Glicerol', '56-81-5', 'C3H8O3', NULL),
  ('Glicina', '56-40-6', 'C2H5NO2', NULL),
  ('Glicose', '50-99-7', 'C6H12O6', NULL),
  ('Glutaraldeído', '111-30-8', 'C5H8O2', NULL),
  ('Hematoxilina', '517-28-2', 'C16H14O6', NULL),
  ('HEPES', '7365-45-9', 'C8H18N2O4S', NULL),
  ('Heptano', '142-82-5', 'C7H16', NULL),
  ('Hexano', '110-54-3', 'C6H14', NULL),
  ('Hidreto de lítio e alumínio', '16853-85-3', 'LiAlH4', 'Polícia Federal'),
  ('Hidroquinona', '123-31-9', 'C6H6O2', NULL),
  ('Hidróxido de alumínio', '21645-51-2', 'Al(OH)3', NULL),
  ('Hidróxido de amônio', '1336-21-6', 'NH4OH', 'Polícia Federal'),
  ('Hidróxido de bário octaidratado', '12230-71-6', 'Ba(OH)2·8H2O', NULL),
  ('Hidróxido de cálcio', '1305-62-0', 'Ca(OH)2', NULL),
  ('Hidróxido de lítio', '1310-65-2', 'LiOH', NULL),
  ('Hidróxido de magnésio', '1309-42-8', 'Mg(OH)2', NULL),
  ('Hidróxido de potássio', '1310-58-3', 'KOH', NULL),
  ('Hidróxido de sódio', '1310-73-2', 'NaOH', NULL),
  ('8-Hidroxiquinolina', '148-24-3', 'C9H7NO', NULL),
  ('Hipoclorito de sódio', '7681-52-9', 'NaClO', NULL),
  ('Imidazol', '288-32-4', 'C3H4N2', NULL),
  ('Iodato de potássio', '7758-05-6', 'KIO3', NULL),
  ('Iodeto de potássio', '7681-11-0', 'KI', NULL),
  ('Iodeto de sódio', '7681-82-5', 'NaI', NULL),
  ('Iodo', '7553-56-2', 'I2', NULL),
  ('Isopropanol', '67-63-0', 'C3H8O', NULL),
  ('Lactose monoidratada', '5989-81-1', 'C12H22O11·H2O', NULL),
  ('Limoneno', '5989-27-5', 'C10H16', NULL),
  ('Magnésio em pó', '7439-95-4', 'Mg', 'Exército'),
  ('Manitol', '69-65-8', 'C6H14O6', 'Polícia Federal'),
  ('2-Mercaptoetanol', '60-24-2', 'C2H6OS', NULL),
  ('Mercúrio', '7439-97-6', 'Hg', NULL),
  ('Metabissulfito de sódio', '7681-57-4', 'Na2S2O5', NULL),
  ('Metanol', '67-56-1', 'CH3OH', NULL),
  ('Metiletilcetona (butanona)', '78-93-3', 'C4H8O', 'Polícia Federal'),
  ('N,N''-Metilenobisacrilamida', '110-26-9', 'C7H10N2O2', NULL),
  ('Molibdato de amônio tetraidratado', '12054-85-2', '(NH4)6Mo7O24·4H2O', NULL),
  ('Molibdato de sódio di-hidratado', '10102-40-6', 'Na2MoO4·2H2O', NULL),
  ('Naftaleno', '91-20-3', 'C10H8', NULL),
  ('Negro de eriocromo T', '1787-61-7', 'C20H12N3NaO7S', NULL),
  ('Ninidrina', '485-47-2', 'C9H6O4', NULL),
  ('Nitrato de alumínio nonaidratado', '7784-27-2', 'Al(NO3)3·9H2O', NULL),
  ('Nitrato de amônio', '6484-52-2', 'NH4NO3', 'Exército'),
  ('Nitrato de bário', '10022-31-8', 'Ba(NO3)2', NULL),
  ('Nitrato de cálcio tetraidratado', '13477-34-4', 'Ca(NO3)2·4H2O', NULL),
  ('Nitrato de chumbo(II)', '10099-74-8', 'Pb(NO3)2', NULL),
  ('Nitrato de cobalto(II) hexaidratado', '10026-22-9', 'Co(NO3)2·6H2O', NULL),
  ('Nitrato de cobre(II) tri-hidratado', '10031-43-3', 'Cu(NO3)2·3H2O', NULL),
  ('Nitrato de ferro(III) nonaidratado', '7782-61-8', 'Fe(NO3)3·9H2O', NULL),
  ('Nitrato de níquel(II) hexaidratado', '13478-00-7', 'Ni(NO3)2·6H2O', NULL),
  ('Nitrato de potássio', '7757-79-1', 'KNO3', 'Exército'),
  ('Nitrato de prata', '7761-88-8', 'AgNO3', NULL),
  ('Nitrato de sódio', '7631-99-4', 'NaNO3', NULL),
  ('Nitrito de sódio', '7632-00-0', 'NaNO2', NULL),
  ('Nitrobenzeno', '98-95-3', 'C6H5NO2', NULL),
  ('Nitroprussiato de sódio di-hidratado', '13755-38-9', 'Na2[Fe(CN)5NO]·2H2O', NULL),
  ('1-Octanol', '111-87-5', 'C8H18O', NULL),
  ('Óxido de alumínio', '1344-28-1', 'Al2O3', NULL),
  ('Óxido de cálcio', '1305-78-8', 'CaO', NULL),
  ('Óxido de cobre(II)', '1317-38-0', 'CuO', NULL),
  ('Óxido de cromo(III)', '1308-38-9', 'Cr2O3', NULL),
  ('Óxido de ferro(III)', '1309-37-1', 'Fe2O3', NULL),
  ('Óxido de magnésio', '1309-48-4', 'MgO', NULL),
  ('Óxido de zinco', '1314-13-2', 'ZnO', NULL),
  ('Oxalato de amônio monoidratado', '6009-70-7', '(NH4)2C2O4·H2O', NULL),
  ('Oxalato de sódio', '62-76-0', 'Na2C2O4', NULL),
  ('Paracetamol', '103-90-2', 'C8H9NO2', 'Polícia Federal'),
  ('Pentano', '109-66-0', 'C5H12', NULL),
  ('Permanganato de potássio', '7722-64-7', 'KMnO4', 'Polícia Federal'),
  ('Persulfato de amônio', '7727-54-0', '(NH4)2S2O8', NULL),
  ('Persulfato de potássio', '7727-21-1', 'K2S2O8', NULL),
  ('Piperidina', '110-89-4', 'C5H11N', 'Polícia Federal'),
  ('Piridina', '110-86-1', 'C5H5N', NULL),
  ('Propilenoglicol', '57-55-6', 'C3H8O2', NULL),
  ('Resorcinol', '108-46-3', 'C6H6O2', NULL),
  ('Sacarose', '57-50-1', 'C12H22O11', NULL),
  ('Safranina O', '477-73-6', 'C20H19ClN4', NULL),
  ('Salicilato de metila', '119-36-8', 'C8H8O3', NULL),
  ('Sódio metálico', '7440-23-5', 'Na', NULL),
  ('Sulfato de alumínio octadecaidratado', '7784-31-8', 'Al2(SO4)3·18H2O', NULL),
  ('Sulfato de amônio', '7783-20-2', '(NH4)2SO4', NULL),
  ('Sulfato de bário', '7727-43-7', 'BaSO4', NULL),
  ('Sulfato de cálcio di-hidratado', '10101-41-4', 'CaSO4·2H2O', NULL),
  ('Sulfato de cobre(II)', '7758-98-7', 'CuSO4', NULL),
  ('Sulfato de cobre(II) pentaidratado', '7758-99-8', 'CuSO4·5H2O', NULL),
  ('Sulfato de ferro(II) amoniacal hexaidratado (sal de Mohr)', '7783-85-9', '(NH4)2Fe(SO4)2·6H2O', NULL),
  ('Sulfato de ferro(II) heptaidratado', '7782-63-0', 'FeSO4·7H2O', NULL),
  ('Sulfato de ferro(III) amoniacal dodecaidratado', '7783-83-7', 'NH4Fe(SO4)2·12H2O', NULL),
  ('Sulfato de hidrazina', '10034-93-2', 'N2H4·H2SO4', NULL),
  ('Sulfato de magnésio', '7487-88-9', 'MgSO4', NULL),
  ('Sulfato de magnésio heptaidratado', '10034-99-8', 'MgSO4·7H2O', NULL),
  ('Sulfato de manganês(II) monoidratado', '10034-96-5', 'MnSO4·H2O', NULL),
  ('Sulfato de níquel(II) hexaidratado', '10101-97-0', 'NiSO4·6H2O', NULL),
  ('Sulfato de potássio', '7778-80-5', 'K2SO4', NULL),
  ('Sulfato de sódio', '7757-82-6', 'Na2SO4', NULL),
  ('Sulfato de zinco heptaidratado', '7446-20-0', 'ZnSO4·7H2O', NULL),
  ('Sulfeto de sódio nonaidratado', '1313-84-4', 'Na2S·9H2O', 'Exército'),
  ('Sulfito de sódio', '7757-83-7', 'Na2SO3', NULL),
  ('Tartarato de sódio e potássio tetraidratado', '6381-59-5', 'KNaC4H4O6·4H2O', NULL),
  ('Tetracloreto de carbono', '56-23-5', 'CCl4', NULL),
  ('Tetra-hidrofurano (THF)', '109-99-9', 'C4H8O', NULL),
  ('N,N,N'',N''-Tetrametiletilenodiamina (TEMED)', '110-18-9', 'C6H16N2', NULL),
  ('Tiocianato de amônio', '1762-95-4', 'NH4SCN', NULL),
  ('Tiocianato de potássio', '333-20-0', 'KSCN', NULL),
  ('Tiossulfato de sódio pentaidratado', '10102-17-7', 'Na2S2O3·5H2O', NULL),
  ('Tioureia', '62-56-6', 'CH4N2S', NULL),
  ('Tolueno', '108-88-3', 'C7H8', 'Polícia Federal'),
  ('Trietanolamina', '102-71-6', 'C6H15NO3', 'Exército'),
  ('Trietilamina', '121-44-8', 'C6H15N', NULL),
  ('Tris(hidroximetil)aminometano (Tris)', '77-86-1', 'C4H11NO3', NULL),
  ('Tungstato de sódio di-hidratado', '10213-10-2', 'Na2WO4·2H2O', NULL),
  ('Ureia', '57-13-6', 'CH4N2O', NULL),
  ('Vanilina', '121-33-5', 'C8H8O3', NULL),
  ('Verde de bromocresol', '76-60-8', 'C21H14Br4O5S', NULL),
  ('Vermelho congo', '573-58-0', 'C32H22N6Na2O6S2', NULL),
  ('Vermelho de metila', '493-52-7', 'C15H15N3O2', NULL),
  ('Zinco metálico', '7440-66-6', 'Zn', NULL);

-- 1. Completa os reagentes que já existem. Se houver duplicados antigos
-- com o mesmo nome, só o mais antigo recebe o CAS.
UPDATE public.reagente r
SET numero_cas = coalesce(r.numero_cas, c.numero_cas),
    composicao_quimica = coalesce(nullif(btrim(r.composicao_quimica), ''), c.formula),
    instituicao_controladora = coalesce(nullif(btrim(r.instituicao_controladora), ''), c.controle)
FROM carga_catalogo c
WHERE r.id = (
    SELECT x.id FROM public.reagente x
    WHERE public.normalizar_nome_reagente(x.nome) = public.normalizar_nome_reagente(c.nome)
    ORDER BY x.data_criacao NULLS LAST, x.id
    LIMIT 1
  )
  AND (
    c.numero_cas IS NULL
    OR r.numero_cas IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM public.reagente y WHERE y.numero_cas = c.numero_cas)
  );

-- 2. Insere os que faltam.
INSERT INTO public.reagente (nome, numero_cas, composicao_quimica, instituicao_controladora)
SELECT c.nome, c.numero_cas, c.formula, c.controle
FROM carga_catalogo c
WHERE NOT EXISTS (
    SELECT 1 FROM public.reagente r
    WHERE public.normalizar_nome_reagente(r.nome) = public.normalizar_nome_reagente(c.nome)
  )
  AND (
    c.numero_cas IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.reagente r WHERE r.numero_cas = c.numero_cas)
  );

-- 3. Avisa (sem alterar) quando o controle já cadastrado difere das
-- portarias. Aparece na saída do "supabase db push"; a correção é feita
-- pela tela de Reagentes por quem conhece o caso.
DO $$
DECLARE
  d record;
BEGIN
  FOR d IN
    SELECT r.nome, r.instituicao_controladora AS cadastrado, c.controle AS portaria
    FROM public.reagente r
    JOIN carga_catalogo c
      ON public.normalizar_nome_reagente(r.nome) = public.normalizar_nome_reagente(c.nome)
      OR r.numero_cas = c.numero_cas
    WHERE coalesce(nullif(btrim(r.instituicao_controladora), ''), '-') <> coalesce(c.controle, '-')
    ORDER BY r.nome
  LOOP
    RAISE NOTICE 'Controle diferente das portarias: % (cadastrado: %, portarias: %)',
      d.nome, coalesce(d.cadastrado, 'nenhum'), coalesce(d.portaria, 'nenhum');
  END LOOP;
END;
$$;
