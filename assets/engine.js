/* engine.js —— 邻答本地规则引擎（GitHub Pages 静态版）
 * 与 Python mock 规则 1:1 对齐：意图分类 / 联想检索(BM25) / 锚点判定 /
 * 拒答分流 / 口语化模板 / 工单 / 追问续接 / 会话 5 分钟过期
 */
(function (global) {
  "use strict";

  // ---------------- 常量 ----------------
  const STOP_CHARS = new Set("的了呢吗吧啊和与及或是在有为对把被从到中上下着过也就都很更最请我你他她它们这那个些一二三".split(""));
  const PUNCT_RE = /[^\u4e00-\u9fffA-Za-z0-9]+/g;

  const SYNONYMS = {
    "物业费": ["物业服务费", "物业费", "管理费"], "停车费": ["停车收费", "停车费", "车位管理费"],
    "车位费": ["车位管理费", "停车收费", "车位租赁费"], "车位": ["车位", "车库"],
    "停车": ["停车", "车位", "停车收费"], "车停": ["停车", "车位", "访客车辆"],
    "灯坏": ["公共照明", "照明", "报修"], "灯不亮": ["公共照明", "照明"], "灯": ["公共照明", "照明"],
    "没住": ["未接受", "无需接受", "未使用"], "没住人": ["未接受", "无需接受"],
    "报修": ["报修", "维修"], "装修": ["装饰装修", "装修"], "装修改造": ["装饰装修", "装修"],
    "翻新": ["装饰装修", "装修"], "宠物": ["饲养宠物", "养犬", "宠物"],
    "养狗": ["养犬", "宠物", "饲养宠物"], "狗": ["犬", "宠物"], "狗狗": ["养犬", "宠物", "犬"],
    "猫": ["宠物", "饲养宠物"], "噪音": ["噪声", "噪音"], "电话": ["联系电话", "电话", "热线"],
    "物业电话": ["联系电话", "热线", "电话"], "热线": ["热线", "联系电话"],
    "垃圾": ["生活垃圾", "垃圾分类", "垃圾"], "扔垃圾": ["生活垃圾分类", "垃圾投放"],
    "电梯": ["电梯"], "押金": ["保证金", "押金"], "保证金": ["装修保证金", "保证金"],
    "公摊": ["公共收益", "共有部分"], "公共收益": ["公共收益"], "广告费": ["广告收益", "公共收益"],
    "收益": ["公共收益"], "收费": ["收费", "收费标准", "费用"],
    "交钱": ["交纳", "缴纳", "缴费"], "交费": ["交纳", "缴纳", "预收"], "缴费": ["交纳", "缴纳"],
    "违规": ["违规", "禁止"], "半夜": ["夜间", "作业时间"], "深夜": ["夜间", "作业时间"],
    "夜里": ["夜间"], "晚上": ["夜间", "作业时间"], "晚上十点": ["夜间", "22:00"],
    "十点": ["22:00"], "十一点": ["23:00"], "十二点": ["24:00"], "凌晨": ["夜间", "作业时间"],
    "周末": ["法定休息日", "休息日", "节假日", "作业时间"], "双休": ["法定休息日", "休息日"],
    "节假日": ["法定休息日", "法定节假日"], "休息日": ["法定休息日", "休息日"],
    "吵": ["噪声", "干扰"], "电瓶车": ["电动自行车", "电动摩托车"],
    "电动车": ["电动自行车", "电动摩托车"], "小电驴": ["电动自行车"],
    "充电": ["充电", "充电设施"], "上门": ["上门", "预约上门"],
    "水管": ["跑水", "给排水", "紧急报修"], "爆管": ["跑水", "紧急报修"],
    "漏水": ["跑水", "漏水", "紧急报修"], "渗水": ["漏水", "渗漏"],
    "坏了": ["故障", "损坏", "维修"], "没人修": ["维修", "报修"], "没人管": ["投诉", "报修"],
    "故障": ["故障", "维修", "报修"], "施工": ["施工", "作业时间"],
    "进出": ["门禁", "车牌识别", "出入"], "大门": ["门禁", "门岗"],
    "门禁卡": ["门禁", "门禁卡"], "办卡": ["门禁卡", "登记"],
    "保安": ["秩序维护", "门岗值守"], "监控": ["监控录像", "安防监控"], "录像": ["监控录像"],
    "上班": ["服务时间"], "下班": ["服务时间"], "开门": ["服务时间", "门禁"],
    "水费": ["代收", "水费"], "电费": ["代收", "电费"], "燃气": ["燃气泄漏", "燃气抢修"],
    "空调外机": ["空调外机", "外立面"], "晾衣架": ["晾衣架", "外立面"],
    "防盗网": ["防盗网", "外立面"], "封阳台": ["封闭阳台", "外立面"], "阳台封闭": ["封闭阳台"],
    "快递": ["配送", "快递"], "外卖": ["配送"], "访客": ["访客车辆", "访客", "报备"],
    "车位租": ["车位租赁", "车位使用协议"], "想租": ["租赁", "承租", "车位租赁"],
    "租个": ["租赁", "车位租赁"], "续租": ["租赁协议", "续租"],
    "高空坠物": ["高空抛物", "高空坠物"], "扔东西": ["高空抛物"],
    "楼道": ["楼道", "公共区域"], "堆东西": ["堆放", "占用"], "占用": ["占用", "堵塞"],
    "消防通道": ["消防车通道", "消防"], "堵车": ["堵塞", "停车秩序"], "车被堵": ["占用", "移车"],
    "刮擦": ["碰撞", "刮擦"], "碰了": ["碰撞", "刮擦"], "撞了": ["碰撞", "事故"],
    "停水": ["供水", "停水"], "停电": ["供电", "停电"], "跳闸": ["供电", "停电"],
    "出入证": ["出入证", "施工人员"], "出租": ["出租", "租赁"],
    "租户": ["承租人", "物业使用人"], "租客": ["承租人", "物业使用人"], "房东": ["业主", "出租"],
    "卖房": ["转让", "变更登记"], "过户": ["转让", "变更登记"], "搬家": ["搬迁", "搬运"],
    "装修垃圾": ["装修垃圾", "清运"], "垃圾清运": ["清运", "垃圾清运"],
    "违约金": ["违约金", "欠费"], "滞纳金": ["欠费", "催告"], "逾期": ["欠费", "催告"],
    "欠费": ["欠交", "催告", "欠费"], "没交": ["欠交", "欠费", "催告"],
    "不交": ["欠交", "欠费"], "没交费": ["欠费", "欠交"],
    "打折": ["折扣"], "优惠": ["优惠"], "免费": ["免费"],
    "业委会": ["业主委员会", "业主大会"], "业主大会": ["业主大会", "业主委员会"],
    "投票": ["业主共同决定", "表决"], "选举": ["业主委员会", "选举"],
    "维修资金": ["专项维修资金"], "维修基金": ["专项维修资金"], "大修": ["专项维修资金", "维修"],
    "拆墙": ["承重结构", "建筑主体", "拆改墙体"], "敲墙": ["承重结构", "建筑主体", "拆改墙体"],
    "面墙": ["承重结构", "建筑主体", "拆改墙体"],
    "开进": ["访客车辆", "车辆进入", "临时停车", "门禁"],
    "按月": ["按季度", "预收", "按年"], "清运费": ["清运费", "据实收取", "代收"],
    "包含": ["构成", "含", "包括"], "亲戚": ["转借", "转让", "他人"],
    "堵了": ["堵塞", "报修", "疏通"], "进场": ["进入", "施工", "作业时间"],
    "下水道": ["管道", "给排水", "疏通", "一般报修"], "电梯费": ["电梯运行费", "电梯费"],
  };

  const QUERY_BOOST = [
    [/多少|几元|费用|收费|价格|标准/, ["元", "收费", "标准", "费用"]],
    [/多久|多长时间|时限|几天|几个小时/, ["分钟"]],
    [/什么时候交|怎么交|在哪交|如何交|交费/, ["交纳", "缴纳", "预收"]],
    [/几点|什么时候|啥时候|时段|作业时间|作息/, ["时间", "工作日"]],
    [/电话|联系/, ["联系电话", "热线", "电话"]],
    [/能不能|可以吗|允许|行不行|禁止/, ["不得", "禁止", "可以", "应当"]],
  ];

  const DOMAIN_TERMS = ["停车", "车位", "车库", "车辆", "访客", "外来", "物业", "物业费", "管理费",
    "装修", "装饰装修", "保证金", "报修", "维修", "电梯", "垃圾", "宠物", "养犬", "狗", "噪音", "噪声",
    "消防", "保洁", "绿化", "门禁", "高空抛物", "收费", "费用", "缴费", "缴纳", "交纳", "电话", "投诉",
    "停水", "停电", "充电", "楼道", "转租", "出租", "施工", "业主大会", "业委会", "专项维修资金",
    "公共收益", "广告", "电动", "自行车", "快递", "外卖", "门岗"];

  const SERVICE_WORDS = ["申报", "办理", "申请", "登记", "开通", "办卡", "预约", "开证明", "缴费"];
  const COMPLAINT_WORDS = ["投诉", "报修", "坏了", "漏水", "渗水", "堵了", "吵", "噪", "扰民", "反映",
    "电梯困", "停水", "停电", "积水", "跳闸", "异响", "扰"];
  const QUESTION_HINT = /[吗？?]|多少|多久|几元|几点|什么时候|能不能|可以吗|允许|行不行|怎么规定|有什么规定|标准|时限|收费|找谁|找哪|归谁管/;
  const RENT_HINT = /想租|要租|租个|租车位|怎么租|车位怎么租|办车位/;
  const PERSONAL_HINT = /我家|我们家|我们楼|我们单元|我住|我这|我房间|我卫生间|我厨房|楼上|楼下|邻居/;
  const CANCEL_HINT = /算了|不用了|取消|不办了|没事了|先不|回头再说/;
  // 进度追问类：指代"处理得怎么样了"，需按流程转人工建单（先追问房号，补上即建单）
  const RESOLVE_HINT = /什么时候给我解决|啥时候解决|什么时候处理|多久能解决|什么时候修好|什么时候弄好|多久能搞定|什么时候来人|啥时候上门|什么时候回复我|给个准信|什么时候弄|处理得怎么样|修得怎么样|怎么还没/;
  // 请求上门服务类：主动要求派人/上门 → 走建单流程（问时限的除外，如"多久安排上门"）
  const REQUEST_VISIT_HINT = /预约上门|安排上门|上门维修|上门看看|派人过来|过来看看|派人上门|安排人来看|让人来看|上门检查|安排师傅|叫师傅|派师傅/;
  const TIME_ASK_HINT = /多久|多长时间|几点|什么时候/;

  // 「上门/上门服务/预约服务/预约上门服务」等关键词与「预约」同时出现才判建单
  function isVisitRequest(q) {
    if (REQUEST_VISIT_HINT.test(q)) return true;
    if (!/预约/.test(q)) return false;
    return /上门|服务|维修|检查|师傅|看/.test(q);
  }
  const PHONE_RE = /\d{11}/;
  const UNIT_RE = /\d{1,3}\s*(?:栋|幢|号楼)\s*[0-9一二三四五六七八九十]{0,2}\s*(?:单元)?\s*\d{0,4}\s*室?|\d{1,3}\s*单元\s*\d{0,4}\s*室?|\d{1,3}\s*-\s*\d{1,3}\s*-\s*\d{1,4}/;

  const _AMOUNT_Q = /多少钱|多少|几元|收费|费用|价格|标准/;
  const _AMOUNT_EV = /\d[\d,.]*\s*元/;
  const _TIME_Q = /多久|多长时间|几个小时|几点|什么时候|时限|上班|开门|关门/;
  const _TIME_EV = /\d{1,2}[:：]\d{2}|\d+\s*(?:分钟|小时|工作日|日内|日前)/;
  const _PERMIT_Q = /能不能|可以吗|行吗|允许|吗/;
  const _PERMIT_EV = /不得|禁止|应当|允许/;
  const _NEG_EV = /禁止|不得/;
  const _PROC_Q = /怎么申报|如何申报|怎么办理|如何办理|需要什么|哪些材料|材料|怎么登记|怎么交/;
  const _PROC_EV = /提交|申报|办理|材料|登记/;
  const _FREE_Q = /免费|收费吗|要不要钱/;
  const _FREE_EV = /免费/;
  const _CONTAIN_Q = /包含|构成|含/;
  const _CONTAIN_EV = /含/;
  const _DISCOUNT_Q = /折扣|打折|优惠|几折/;
  const _NAME_Q = /名字|姓名|叫什么|是谁/;
  const _GENERAL_EV = /禁止|不得|应当/;

  // 错字/别字归一化：常见音近、形近错别字 → 正确用字（仅作用于查询，不改条款原文）
  const TYPO_MAP = [
    ["物夜费", "物业费"], ["物也费", "物业费"], ["物叶费", "物业费"], ["物费", "物业费"],
    ["负业费", "物业费"], ["停撤费", "停车费"], ["停车非", "停车费"], ["停撤", "停车"], ["挺车", "停车"],
    ["单园", "单元"], ["单员", "单元"], ["单远", "单元"], ["但愿", "单元"], ["单原", "单元"],
    ["保休", "保修"], ["保收", "保修"], ["维休", "维修"], ["违修", "维修"], ["维收", "维修"],
    ["门近", "门禁"], ["门金", "门禁"], ["住护", "住户"], ["住互", "住户"],
    ["车为", "车位"], ["车伪", "车位"], ["车维", "车位"], ["撤位", "车位"],
    ["停车为", "停车位"], ["停撤位", "停车位"],
    ["装休", "装修"], ["壮修", "装修"], ["壮休", "装修"],
    ["压金", "押金"], ["鸭金", "押金"],
    ["漏税", "漏水"], ["楼水", "漏水"],
    ["澡音", "噪音"], ["燥音", "噪音"], ["造音", "噪音"],
    ["电体", "电梯"], ["电涕", "电梯"],
    ["懂", "栋"], ["冻", "栋"],
    ["门禁卡", "门禁卡"], ["缴非", "缴费"], ["缴废", "缴费"],
    ["清运非", "清运费"], ["清运废", "清运费"],
  ];

  function fixTypos(q) {
    let x = q || "";
    for (const [a, b] of TYPO_MAP) if (x.includes(a)) x = x.split(a).join(b);
    x = x.replace(/(\d)\s*东/g, "$1栋");   // 房号语境：3东 → 3栋
    x = x.replace(/[oO]/g, "0");           // 数字混淆：o/O → 0
    return x;
  }

  const REFUSE_TPL = "这个问题涉及您家的具体情况，需要物业人工确认。已为您生成工单（编号：{ticket_id}），物业将在24小时内与您联系。如需加急请拨打物业电话。";
  // 多轮补全信息后的建单话术：上文已铺垫，直接说明建单，不再重复"需人工确认"
  const DIRECT_TPL = "已为您生成工单（编号：{ticket_id}），物业将在24小时内与您联系。如需加急请拨打物业电话。";
  const OUT_OF_SCOPE_TPL = "抱歉，这个问题不在我的回答范围内。我可以帮您查小区的制度规定（停车、装修、物业费、报修时限等）、解答办事流程，或者帮您报修投诉。";
  const FOLLOWUP_TPL = "为了帮您建单，还需要确认一下：{questions}";
  const CANCEL_TPL = "好的，有需要随时找我。";
  // 无前文的「预约上门」：先获取具体诉求
  const ASK_DETAIL_TPL = "好的，请问您需要上门处理什么问题呢？把具体情况告诉我（比如漏水、断电、门禁故障等），我来帮您安排。";
  // 手机号位数不足的提示
  const PHONE_ERR_TPL = "请输入正确的手机号";

  const ORAL_RULES = [
    ["本小区", "咱们小区"], ["业主、物业使用人", "业主和住户"], ["业主或物业使用人", "业主或住户"],
    ["不得", "不能"], ["应当", "需要"], ["未", "没"], ["／", "或"],
    ["元/个·月", "元一个月"], ["元/小时", "元每小时"], ["元/㎡·月", "元每平方米每月"],
    ["予以", "给予"], ["实施", "做"],
  ];

  // ---------------- 工具 ----------------
  function tokenize(text) {
    text = (text || "").replace(PUNCT_RE, "");
    const toks = [];
    let i = 0;
    const n = text.length;
    while (i < n) {
      const ch = text[i];
      if (ch >= "\u4e00" && ch <= "\u9fff") {
        let j = i;
        while (j < n && text[j] >= "\u4e00" && text[j] <= "\u9fff") j++;
        const run = text.slice(i, j);
        for (let k = 0; k < run.length; k++) {
          if (!STOP_CHARS.has(run[k])) toks.push(run[k]);
          if (k + 1 < run.length) toks.push(run.slice(k, k + 2));
        }
        i = j;
      } else {
        let j = i;
        while (j < n && !(text[j] >= "\u4e00" && text[j] <= "\u9fff")) j++;
        const seg = text.slice(i, j);
        const m = seg.match(/[A-Za-z0-9]+/g);
        if (m) for (const w of m) toks.push(w.toLowerCase());
        i = j;
      }
    }
    return toks;
  }

  const isCn = s => s.length >= 2 && [...s].every(c => c >= "\u4e00" && c <= "\u9fff");

  function extractSlots(text) {
    const slots = {};
    const m1 = PHONE_RE.exec(text || "");
    if (m1) slots.contact = m1[0];
    const m2 = UNIT_RE.exec(text || "");
    if (m2) slots.location = m2[0].trim().replace(/[，。、,.!！?？;；]$/, "");
    return slots;
  }

  // 房号缺什么问什么：返回缺失项文案；齐全返回 null
  function unitMissing(loc) {
    if (!loc) return "您的楼栋、单元和房号（如 3 栋 2 单元 501）";
    if (/^\d{1,3}\s*-\s*\d{1,3}\s*-\s*\d{1,4}$/.test(loc)) return null; // 3-2-501 全齐
    const parts = [];
    if (!/\d{1,3}\s*[栋幢号楼]/.test(loc)) parts.push("楼栋号");
    if (!/\d{1,3}\s*单元/.test(loc)) parts.push("单元");
    if (!/\d{1,4}\s*[室号]?\s*$/.test(loc)) parts.push("房间号");
    return parts.length ? "您的" + parts.join("、") : null;
  }

  // 合并房号补充（渐进式）：
  //  已有"2 单元 501"，给"9栋"→"9栋2 单元 501"；给"2单元"→插入楼栋后；给"201"→替换房号
  function mergeLocation(existing, text) {
    const ex = extractSlots(text);
    const t = (text || "").trim();
    if (ex.location) {
      const el = ex.location.trim();
      if (!existing) return el;
      // 纯楼栋补全（如"9栋"）：拼到最前
      if (/^\d{1,3}\s*[栋幢号楼]\s*$/.test(el)) return el + existing;
      // 单元补全（如"2 单元"或"2 单元 501"）：插到楼栋之后，丢弃残缺尾部；
      // 若只给单元且已有房号，保留已有房号
      if (/^\d{1,3}\s*单元/.test(el)) {
        const m = existing.match(/^(\d{1,3}\s*[栋幢号楼])/);
        if (m) {
          const room = /^\d{1,3}\s*单元\s*$/.test(el) ? existing.match(/\d{1,4}\s*室?\s*$/) : null;
          return m[1] + el + (room ? room[0] : "");
        }
      }
      return el;
    }
    const m = t.match(/^(\d{1,4})\s*[室号]?\s*$/);
    if (m) {
      if (existing) {
        // 已有房号时视为更正：替换末尾房号
        const base = existing.trim().replace(/\d{1,4}\s*室?\s*$/, "");
        return base + m[1] + "室";
      }
      return m[1] + "室";
    }
    return existing;
  }

  // 建单前必问清单：房号缺什么问什么 + 电话
  function buildMissingQs(slots, profile) {
    const qs = [];
    const loc = slots.location || (profile || {}).unit || "";
    const miss = unitMissing(loc);
    if (miss) qs.push(miss);
    if (!(slots.contact || (profile || {}).phone)) qs.push("联系电话");
    return qs;
  }

  // 是否在尝试报手机号但位数不足：纯数字不足 11 位，或带电话字样且数字不足 11 位
  function looksLikePhoneAttempt(text) {
    const t = (text || "").trim();
    const digits = t.replace(/\D/g, "");
    if (!digits || digits.length >= 11) return false;
    return /^\d+$/.test(t) || /电话|手机|号码|联系方式|手机号/.test(t);
  }

  // 工单摘要：从上下文提炼标准事件短语；无则"无"
  const SUMMARY_MAP = [
    [/漏水|渗水|跑水|冒水|积水|水管|水龙头|爆管/, "漏水报修"],
    [/停电|跳闸|断电|漏电/, "停电报修"],
    [/困人|电梯/, "电梯报修"],
    [/噪音|噪声|吵|扰民/, "噪音投诉"],
    [/门禁|门锁/, "门禁报修"],
    [/燃气|漏气|煤气/, "燃气报修"],
    [/消防|着火|火情/, "消防报修"],
    [/垃圾|保洁|卫生|异味/, "保洁投诉"],
    [/停车|车位|车辆/, "停车咨询"],
    [/物业费|管理费|物业非|物也费/, "物业费咨询"],
  ];
  function summarize(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      for (const [re, label] of SUMMARY_MAP) {
        if (re.test(messages[i])) return label;
      }
    }
    return "无";
  }

  function oralize(t) {
    let x = t || "";
    for (const [a, b] of ORAL_RULES) x = x.split(a).join(b);
    return x.replace(/\s+/g, " ").trim();
  }

  // ---------------- 知识库 ----------------
  let KB = null;
  function loadKB(raw) {
    const clauses = raw.clauses.filter(c => c.doc === "clause");
    const attachments = raw.clauses.filter(c => c.doc !== "clause");
    // 附件放末尾，保证 units 顺序与 clauses 检索池一致（与 Python 端对齐）
    const units = clauses.concat(attachments);
    const docsTf = [], docLen = [], df = new Map();
    for (const c of units) {
      const tf = new Map();
      for (const t of tokenize(c.t)) tf.set(t, (tf.get(t) || 0) + 1);
      for (const t of tokenize(c.s || "")) tf.set(t, (tf.get(t) || 0) + 1.5);
      for (const t of tokenize(c.f + c.f)) tf.set(t, (tf.get(t) || 0) + 2.0);
      docsTf.push(tf);
      docLen.push([...tf.values()].reduce((a, b) => a + b, 0));
      for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    }
    KB = {
      raw, clauses, attachments, units, docsTf, docLen, df,
      N: units.length, avgdl: docLen.reduce((a, b) => a + b, 0) / units.length,
      byId: Object.fromEntries(raw.clauses.map(c => [c.id, c])),
    };
  }

  function expandQuery(q) {
    const toks = tokenize(q);
    const extra = [];
    for (const [k, alts] of Object.entries(SYNONYMS)) {
      if (q.includes(k)) for (const a of alts) extra.push(...tokenize(a));
    }
    for (const [pat, words] of QUERY_BOOST) {
      if (pat.test(q)) for (const w of words) extra.push(...tokenize(w));
    }
    return toks.concat(extra);
  }

  function idf(t) {
    const n = KB.df.get(t) || 0;
    return Math.log(1 + (KB.N - n + 0.5) / (n + 0.5));
  }

  function search(query, topK = 12, fileFilter = null) {
    const q = expandQuery(query);
    if (!q.length) return [];
    const qset = new Map();
    for (const t of q) qset.set(t, (qset.get(t) || 0) + 1);
    let pool = KB.clauses;
    if (fileFilter) pool = pool.filter(c => c.f === fileFilter);
    const scores = [];
    pool.forEach((c, idx) => {
      const tf = KB.docsTf[idx], dl = Math.max(KB.docLen[idx], 1);
      let s = 0;
      for (const [t, qn] of qset) {
        const f = tf.get(t) || 0;
        if (!f) continue;
        s += qn * idf(t) * (f * (1.5 + 1)) / (f + 1.5 * (1 - 0.75 + 0.75 * dl / KB.avgdl));
      }
      if (s > 0) scores.push([s, c]);
    });
    scores.sort((a, b) => b[0] - a[0]);
    return scores.slice(0, topK).map(([s, c]) => ({ clause: c, score: Math.round(s * 1000) / 1000 }));
  }

  function searchFused(query, topK = 8) {
    const hits = search(query, topK);
    const ids = new Set(hits.map(h => h.clause.id));
    if (hits.length && hits[0].score >= 12) return hits;
    const clean = (query || "").replace(PUNCT_RE, "");
    const words = clean.match(/[\u4e00-\u9fff]{3,4}/g) || [];
    words.push(...(clean.match(/[\u4e00-\u9fff]{2}/g) || []));
    const chars = new Set([...clean].filter(c => c >= "\u4e00" && c <= "\u9fff" && !STOP_CHARS.has(c)));
    const scored = [];
    for (const c of KB.clauses) {
      let s = 0;
      for (const w of words) {
        if (c.t.includes(w)) s += 3;
        if ((c.s || "").includes(w)) s += 1.5;
      }
      for (const ch of chars) if (c.t.includes(ch)) s += 0.4;
      if (s > 0) scored.push([Math.round(s * 100) / 100, c]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    for (const [s, c] of scored.slice(0, 8)) {
      if (!ids.has(c.id)) { hits.push({ clause: c, score: s, fuzzy: true }); }
      if (hits.length >= topK + 3) break;
    }
    return hits.slice(0, topK);
  }

  function retrieve(queries) {
    const merged = new Map(), origin = new Map();
    for (const q of queries) {
      for (const h of searchFused(q, 8)) {
        const id = h.clause.id;
        if (!merged.has(id) || h.score > merged.get(id).score) {
          merged.set(id, h);
          origin.set(id, q);
        }
      }
    }
    return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, 10);
  }

  function baseExtra(q) {
    const raw = new Set(tokenize(q).filter(isCn));
    const full = new Set(expandQuery(q).filter(isCn));
    const syn = new Set();
    for (const [k, alts] of Object.entries(SYNONYMS)) {
      if (q.includes(k)) for (const a of alts) for (const t of tokenize(a)) if (isCn(t)) syn.add(t);
    }
    return [raw, new Set([...full].filter(t => !raw.has(t))), new Set([...syn].filter(t => !raw.has(t)))];
  }

  function mockScore(hit, base, extra, anchors, negEv, urgent, channel) {
    let s = hit.score;
    const text = hit.clause.t;
    for (const ev of anchors) if (ev.test(text)) s += 4;
    if (negEv && negEv.test(text)) s += 10;
    if (urgent && text.includes("紧急")) s += 8;
    if (channel && /报修|受理/.test(text)) s += 6;
    if (text.length > 800) s *= 0.5;
    return s;
  }

  function mockJudge(message, hits) {
    const q = message || "";
    const [base, extra, syn] = baseExtra(q);
    const ins = (missing, kind) => ({ verdict: "insufficient", selected: [], missing, kind });
    // 以下短路优先于领域检查：进度追问 / 请求上门 必须走建单流程
    if (RESOLVE_HINT.test(q)) return ins("进度追问，转人工建单", "need_human");
    if (isVisitRequest(q) && !TIME_ASK_HINT.test(q))
      return ins("请求上门服务，转人工建单", "need_human");
    const domainHit = DOMAIN_TERMS.some(d => q.includes(d)) || syn.size > 0;
    const fuzzyHit = hits.some((h, i) => i < 3 && h.fuzzy);
    if (!domainHit && !fuzzyHit) return ins("不涉及小区事务，且联想检索无依据", "out_of_scope");
    if (hits.length && base.size === 0 && extra.size === 0 && !fuzzyHit)
      return ins("查询无有效词", "out_of_scope");
    if (PERSONAL_HINT.test(q) && !QUESTION_HINT.test(q) && /漏水|渗水|坏了|故障|停电|跳闸|积水|堵了|冒水|爆了/.test(q))
      return ins("个案报修，需转人工", "need_human");
    if (_NAME_Q.test(q)) return ins("知识库不含个人姓名信息", "out_of_scope");
    if (_DISCOUNT_Q.test(q)) {
      const cands = hits.slice(0, 10).filter(h => _DISCOUNT_Q.test(h.clause.t));
      if (!cands.length) return ins("制度中无折扣信息", "out_of_scope");
      cands.sort((a, b) => mockScore(b, base, extra, [_DISCOUNT_Q], null, false, false)
        - mockScore(a, base, extra, [_DISCOUNT_Q], null, false, false));
      return { verdict: "sufficient", selected: [{ id: cands[0].clause.id, reason: "折扣证据命中" }], missing: "", kind: "sufficient" };
    }
    const anchors = [];
    if (_AMOUNT_Q.test(q)) anchors.push(_AMOUNT_EV);
    if (_TIME_Q.test(q)) anchors.push(_TIME_EV);
    const permit = _PERMIT_Q.test(q);
    if (permit) anchors.push(_PERMIT_EV);
    if (_PROC_Q.test(q)) anchors.push(_PROC_EV);
    if (_FREE_Q.test(q)) anchors.push(_FREE_EV);
    if (_CONTAIN_Q.test(q)) anchors.push(_CONTAIN_EV);
    const negEv = permit ? _NEG_EV : null;
    const channelQ = /找谁|找哪|报修|联系|电话|热线|管吗|管不管/.test(q);
    const urgentQ = /半夜|凌晨|深夜|紧急|困人|着火|爆管|漏电/.test(q);
    const transferQ = /转借|转让|转租|亲戚|别人|他人/.test(q);

    const passes = h => {
      const text = h.clause.t;
      if (channelQ) {
        if (/多少|号码|电话/.test(q) && !/找谁|找哪/.test(q)) return /\d{4}/.test(text);
        return /报修|受理|热线/.test(text);
      }
      if (transferQ) return /转借|转让|转租/.test(text);
      if (anchors.length) return anchors.some(ev => ev.test(text)) || text.includes("〔表格〕");
      return _GENERAL_EV.test(text) || text.includes("〔表格〕");
    };

    let cands = hits.slice(0, 10).filter(passes);
    if (!cands.length) {
      cands = hits.slice(0, 8).filter(h => h.clause.t.includes("〔表格〕")
        || (h.fuzzy && _GENERAL_EV.test(h.clause.t)));
    }
    if (urgentQ && !channelQ) {
      const seen = new Set(cands.map(h => h.clause.id));
      for (const h of search(q + " 紧急报修 到场", 5)) {
        if (!seen.has(h.clause.id) && h.clause.t.includes("紧急")) cands.push(h);
      }
      let u = cands.filter(h => h.clause.t.includes("紧急") && /\d+\s*分钟/.test(h.clause.t));
      if (!u.length) u = cands.filter(h => h.clause.t.includes("紧急"));
      if (u.length) cands = u;
    }
    if (!cands.length) return ins("候选条款无对应证据", "need_human");

    cands.sort((a, b) => mockScore(b, base, extra, anchors, negEv, urgentQ, channelQ)
      - mockScore(a, base, extra, anchors, negEv, urgentQ, channelQ));
    const c = cands[0].clause;
    const dt = new Set(tokenize(c.t));
    const strong = new Set([...base, ...syn]);
    if (![...strong].some(t => dt.has(t))
      && !(c.t.includes("〔表格〕") && [...extra].some(t => dt.has(t)))) {
      return ins("查询与条款无语义交集", "out_of_scope");
    }
    return { verdict: "sufficient", selected: [{ id: c.id, reason: "锚点命中" }], missing: "", kind: "sufficient" };
  }

  function tableHeader(text) {
    for (const line of text.split("\n")) if (line.includes("|")) return line;
    return "";
  }

  function pickTableLine(text, message) {
    const [base, extra] = baseExtra(message);
    const urgent = /漏水|漏电|跑水|燃气|电梯困|紧急/.test(message || "");
    const wantFee = /车位费|管理费|物业费/.test(message || "");
    let best = null, score = 0;
    for (const line of text.split("\n")) {
      if (!line.includes("|")) continue;
      const st = new Set(tokenize(line));
      let s = 5 * [...base].filter(t => st.has(t)).length + [...extra].filter(t => st.has(t)).length;
      if (urgent && line.includes("紧急")) s += 5;
      if (wantFee && line.includes("管理费")) s += 4;
      if (s > score) { best = line; score = s; }
    }
    return best;
  }

  function pickSentence(body, message) {
    const sents = body.split("。").map(s => s.trim()).filter(Boolean);
    if (sents.length <= 1) return body;
    const [base] = baseExtra(message);
    const permitQ = /吗|能不能|可以吗|行吗/.test(message || "");
    const scored = sents.map((s, i) => {
      const st = new Set(tokenize(s));
      let v = [...base].filter(t => st.has(t)).length;
      if (permitQ && /不能|禁止|不得/.test(s)) v += 3;
      return [v, i];
    });
    scored.sort((a, b) => b[0] - a[0]);
    const best = scored[0][1];
    return sents.slice(Math.max(0, best - 1), best + 1).join("。");
  }

  function oralizeTableLine(header, line) {
    const cols = line.split("|").map(s => s.trim()).filter(Boolean);
    const hdr = header || "";
    if (hdr.includes("响应时限") || hdr.includes("办结")) {
      if (cols.length >= 3) return `${oralize(cols[0])}的话，物业${oralize(cols[1])}。${oralize(cols[2])}`;
    }
    if (hdr.includes("收费") || hdr.includes("标准")) {
      if (cols.length >= 3) {
        const head = oralize(cols[0]), std = oralize(cols[1]);
        if (std.includes("免费")) return `${head}${std}，${oralize(cols[2])}。`;
        return `${head}是${std}，${oralize(cols[2])}。`;
      }
    }
    if (hdr.includes("电话") || hdr.includes("热线")) {
      if (cols.length >= 2) {
        const tail = cols.length > 2 && cols[2] ? `，${oralize(cols[2])}` : "";
        return `${oralize(cols[0])}的联系方式是${oralize(cols[1])}${tail}。`;
      }
    }
    return oralize(cols.join("，"));
  }

  function mockAnswer(message, selectedIds, intent) {
    const clauses = selectedIds.map(id => KB.byId[id]).filter(Boolean);
    if (!clauses.length) return null;
    const c = clauses[0];
    let body = c.t;
    if (body.includes("〔表格〕")) {
      const header = tableHeader(body);
      const line = pickTableLine(body, message);
      body = line ? oralizeTableLine(header, line) : oralize(body.split("〔表格〕")[0]);
    } else {
      body = body.replace(/^第[一二三四五六七八九十百零〇\d]+条[\s\u3000]*/, "").replace(/\n/g, " ");
      body = pickSentence(body, message);
      body = oralize(body);
      if (!/^(咱|按|禁|物业服务中心服务时间)/.test(body)) body = "按小区规定，" + body;
    }
    body = body.replace(/^[，。\s]+|[，。\s]+$/g, "");
    const limit = intent === "service" ? 250 : 150;
    if (body.length > limit - 30) body = body.slice(0, limit - 30);
    const cite = `（出处：《${c.f}》${c.n}）`;
    return { answer: `${body}。${cite}`, sources: clauses.slice(0, 2).map(x => ({ file: x.f, clause: x.n })) };
  }

  function mockTicket(message, intent, slots, profile) {
    const msg = message || "";
    let level = "低";
    if (/漏水|漏电|燃气|电梯困|困人|触电|着火|火灾/.test(msg)) level = "高";
    else if (/噪|吵|扰|停水|停电|跳闸|异味|脏|垃圾|占用|堵塞|门禁|积水|卫生|异响/.test(msg)) level = "中";
    let cat = "咨询";
    if (intent === "service") cat = "办理";
    else if (/漏水|渗水|坏了|故障|维修|电梯|修|跳闸|积水|异响/.test(msg)) cat = "报修";
    else if (/投诉|噪|吵|扰|脏|垃圾|卫生|占用|堵/.test(msg)) cat = "投诉";
    const contact = slots.contact || (profile || {}).phone || "";
    return {
      "问题描述": (msg.replace(/\s+/g, " ") || "业主咨询").slice(0, 60),
      "类别": cat, "紧急程度": level,
      "涉及位置": slots.location || (profile || {}).unit || "",
      "电话": contact,
      "备注": contact ? `联系方式：${contact}` : "",
    };
  }

  function isOutOfScope(q, hits) {
    if (_DISCOUNT_Q.test(q) || _NAME_Q.test(q)) return true;
    const [, , syn] = baseExtra(q);
    const domainHit = DOMAIN_TERMS.some(d => q.includes(d)) || syn.size > 0 || PERSONAL_HINT.test(q);
    const fuzzyHit = hits.some((h, i) => i < 3 && h.fuzzy);
    return !domainHit && !fuzzyHit;
  }

  // ---------------- 会话（窗口存活期间保留，关闭窗口即销毁） ----------------
  // 浏览器：sessionStorage（同标签页内刷新保留、关闭标签页销毁、开新标签页独立）
  // Node 测试环境：内存 Map 兜底
  const HAS_SESSION_STORE = (() => {
    try { return typeof sessionStorage !== "undefined"; } catch (e) { return false; }
  })();
  const MEM_SESSIONS = new Map();
  const SKEY = sid => "linda_session_" + sid;

  function getSession(sid) {
    if (HAS_SESSION_STORE) {
      let s = null;
      try { s = JSON.parse(sessionStorage.getItem(SKEY(sid)) || "null"); } catch (e) { s = null; }
      if (!s) s = { history: [], slots: {} };
      return s;
    }
    let s = MEM_SESSIONS.get(sid);
    if (!s) { s = { history: [], slots: {} }; MEM_SESSIONS.set(sid, s); }
    return s;
  }
  function saveSession(sid, s) {
    if (HAS_SESSION_STORE) {
      try { sessionStorage.setItem(SKEY(sid), JSON.stringify(s)); } catch (e) { /* 容量超限时放弃持久化 */ }
    }
  }
  function appendTurn(sid, role, content, extra) {
    const s = getSession(sid);
    s.history.push(Object.assign({ role, content }, extra || {}));
    if (s.history.length > 12) s.history = s.history.slice(-12);
    saveSession(sid, s);
  }

  // ---------------- 主入口 ----------------
  function handle(sid, message, profile) {
    message = fixTypos((message || "").trim()).slice(0, 1000);
    const t0 = Date.now();
    const session = getSession(sid);
    const prev = session.history[session.history.length - 1];
    const priorUserCount = session.history.filter(x => x.role === "user").length;
    let supplement = null;
    let interrupted = false;

    // 无前文的「预约上门」：先获取具体诉求，再走建单流程
    if (isVisitRequest(message) && !TIME_ASK_HINT.test(message)
        && priorUserCount === 0 && !prev) {
      appendTurn(sid, "user", message);
      appendTurn(sid, "assistant", ASK_DETAIL_TPL, { intent: "complaint", refused: false, followUp: true });
      return { intent: "complaint", intent_label: "投诉报修", answer: ASK_DETAIL_TPL,
        sources: [], refused: false, ticket: null,
        follow_up: { needed: true, questions: ["具体诉求"] }, citations_ok: null,
        candidates: [], latency_ms: Date.now() - t0 };
    }

    if (prev && prev.role === "assistant" && prev.followUp) {
      if (CANCEL_HINT.test(message)) {
        appendTurn(sid, "user", message);
        appendTurn(sid, "assistant", CANCEL_TPL);
        return { intent: "complaint", intent_label: "投诉报修", answer: CANCEL_TPL,
          sources: [], refused: false, ticket: null, follow_up: { needed: false, questions: [] },
          citations_ok: null, candidates: [], latency_ms: Date.now() - t0 };
      }
      // 是否在补信息（房号/电话/数字），否则视为打断追问的新问题
      const sl = extractSlots(message);
      const isSupplement = !!(sl.location || sl.contact) || looksLikePhoneAttempt(message)
        || /^\d{1,4}\s*[室号]?\s*$/.test(message.trim());
      if (isSupplement) {
        const prevUser = [...session.history].reverse().find(x => x.role === "user");
        supplement = prevUser ? prevUser.content : message;
      } else {
        interrupted = true;  // 新问题：停止本次追问，先正常回答
      }
    }
    appendTurn(sid, "user", message);

    if (supplement) {
      const ex = extractSlots(message);
      // 先判定手机号尝试：房号已齐、只差电话、给了不足 11 位的数字 → 提示错误（不得并入房号）
      const curLoc = session.slots.location || "";
      const curLocOk = !unitMissing(curLoc || (profile || {}).unit || "");
      if (curLocOk && !(session.slots.contact || (profile || {}).phone)
          && looksLikePhoneAttempt(message) && !ex.location) {
        appendTurn(sid, "assistant", PHONE_ERR_TPL, { intent: "complaint", refused: false, followUp: true });
        return { intent: "complaint", intent_label: "投诉报修", answer: PHONE_ERR_TPL,
          sources: [], refused: false, ticket: null,
          follow_up: { needed: true, questions: ["联系电话"] }, citations_ok: null,
          candidates: [], latency_ms: Date.now() - t0 };
      }
      const prevLoc = session.slots.location || "";
      const slots = Object.assign({}, session.slots, ex);
      const mergedLoc = mergeLocation(prevLoc, message);
      if (mergedLoc) slots.location = mergedLoc;
      session.slots = slots;
      saveSession(sid, session);
      // 房号缺什么问什么、电话未给问电话
      const qs = buildMissingQs(slots, profile);
      if (qs.length) {
        // 信息仍不全 → 继续追问（保持流程）
        const answer = FOLLOWUP_TPL.replace("{questions}", qs.join("、"));
        appendTurn(sid, "assistant", answer, { intent: "complaint", refused: false, followUp: true });
        return { intent: "complaint", intent_label: "投诉报修", answer, sources: [], refused: false,
          ticket: null, follow_up: { needed: true, questions: qs }, citations_ok: null,
          candidates: [], latency_ms: Date.now() - t0 };
      }
      // 工单描述优先取本会话的具体报修内容，而不是"什么时候给我解决/预约上门"这类追问
      const histUsers = session.history.filter(x => x.role === "user").map(x => x.content);
      const desc = summarize(histUsers);
      const tk = mockTicket(desc, "complaint", slots, profile);
      tk.ticket_id = newTicketId();
      const answer = DIRECT_TPL.replace("{ticket_id}", tk.ticket_id);
      appendTurn(sid, "assistant", answer, { intent: "complaint", refused: true });
      return { intent: "complaint", intent_label: "投诉报修", answer, sources: [], refused: true,
        ticket: tk, follow_up: { needed: false, questions: [] }, citations_ok: null,
        candidates: [], latency_ms: Date.now() - t0 };
    }

    // 意图
    let intent = "policy_qa";
    if (RESOLVE_HINT.test(message)) intent = "complaint";
    else if (isVisitRequest(message) && !TIME_ASK_HINT.test(message)) intent = "complaint";
    else if (QUESTION_HINT.test(message)) intent = "policy_qa";
    else if (RENT_HINT.test(message) || SERVICE_WORDS.some(w => message.includes(w))) intent = "service";
    else if (COMPLAINT_WORDS.some(w => message.includes(w))) intent = "complaint";
    const p1slots = extractSlots(message);
    for (const k of Object.keys(p1slots)) if (p1slots[k]) session.slots[k] = p1slots[k];
    saveSession(sid, session);
    const slots = session.slots;

    const hits = retrieve([message]);
    const j = mockJudge(message, hits);
    const result = {
      intent, intent_label: { policy_qa: "制度问答", service: "事务办理", complaint: "投诉报修" }[intent],
      answer: "", sources: [], refused: false, ticket: null,
      follow_up: { needed: false, questions: [] }, citations_ok: null,
      candidates: hits.slice(0, 5).map(h => ({ id: h.clause.id, file: h.clause.f, clause: h.clause.n, score: h.score })),
    };

    if (j.verdict === "sufficient") {
      const a = mockAnswer(message, j.selected.map(s => s.id), intent);
      if (a) {
        result.answer = a.answer; result.sources = a.sources; result.citations_ok = true;
      }
    }

    if (!result.refused && !result.answer) {
      const needInfo = intent === "complaint";
      // 房号缺什么问什么、电话未给问电话
      const qs = buildMissingQs(slots, profile);
      if (needInfo && qs.length) {
        result.answer = FOLLOWUP_TPL.replace("{questions}", qs.join("、"));
        result.follow_up = { needed: true, questions: qs };
      } else if (j.kind === "out_of_scope" || (j.kind !== "need_human" && isOutOfScope(message, hits))) {
        result.answer = OUT_OF_SCOPE_TPL;
        result.refused = true;
      } else {
        // 建单描述结合上文：优先取本会话含事件词的发言（如"漏水"），而非干巴巴的"预约上门"
        const histUsers = session.history.filter(x => x.role === "user").map(x => x.content);
        const desc = summarize(histUsers);
        const tk = mockTicket(desc, intent, slots, profile);
        tk.ticket_id = newTicketId();
        result.answer = REFUSE_TPL.replace("{ticket_id}", tk.ticket_id);
        result.ticket = tk;
        result.refused = true;
      }
    }

    result.latency_ms = Date.now() - t0;
    // 打断追问：仅当新问题正常作答（非追问、非拒答）时，才在下方追加补全信息追问
    let pendingQs = [];
    if (interrupted && !result.follow_up.needed && !result.refused) {
      pendingQs = buildMissingQs(slots, profile);
    }
    if (pendingQs.length) {
      result.append_followup = FOLLOWUP_TPL.replace("{questions}", pendingQs.join("、"));
    }
    const keepFollowUp = result.follow_up.needed || pendingQs.length > 0;
    appendTurn(sid, "assistant", result.answer, {
      intent, sources: result.sources, refused: result.refused,
      followUp: keepFollowUp,
    });
    return result;
  }

  let ticketSeq = 0;
  function newTicketId() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    const day = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    ticketSeq += 1;
    return `T${day}-${String(ticketSeq).padStart(4, "0")}`;
  }

  global.LindaEngine = {
    loadKB, handle, tokenize, getSession,
    // 供后端（Workers）完整模式使用：本地规则引擎检索出候选条款，交给 DeepSeek 判定与生成
    searchCandidates(message, topK = 10) {
      return retrieve([message]).map(h => ({
        id: h.clause.id, file: h.clause.f, clause: h.clause.n, text: h.clause.t,
      }));
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
