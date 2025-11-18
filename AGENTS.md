请不要修改此文档.

## 项目简介
本项目是移动端项目

## 技术栈
- UI组件库: Vant UI
- 图表库: ECharts 5.5.0 (用于 K线图展示)
- 后端: Supabase

## 样式
能用到vant-ui的都使用vant-ui

## 数据库
用的supabase,我没有用的supabase cli,都是web操作.

### 数据库表关系说明
- `watchlist`（自选股）和 `track`（操作记录）是逻辑关联，无外键约束
- 原因：操作记录应永久保留，不受自选股添加/删除影响
- 关联方式：通过 `stock + invt` 字段进行逻辑关联
- 查询示例：在股票详情页面可以查看该股票的所有历史操作记录

### 路由文件规则,`/view/***/index.vue`.

## 股票数据api
为了避免跨域限制,接口都通过 Supabase Edge Function 代理访问,Edge Function 位于 `supabase/functions/stock-search/`

* 获取股票列表,可以用来搜索用
  - 腾讯接口: https://proxy.finance.qq.com/ifzqgtimg/appstock/smartbox/search/get
  - 参数`q`,值可以是股票代码,也可以是拼音缩写,也可以是汉字.
  - 返回的数据结构如下:
  ```json
    {
      "code": 0,
      "msg": "",
      "data": {
        "sector": [],
        "manager": [],
        "stock": [
            [
                "sh",
                "601689",
                "拓普集团",
                "",
                "GP-A"
            ],
            [
                "sz",
                "002233",
                "塔牌集团",
                "",
                "GP-A"
            ]
        ],
      }
    }
  ```
  - GP-A是股票的意思,我们只看GP-A开头的数据.
    
* 获取股票详情
  - 东方财富接口https://push2delay.eastmoney.com/api/qt/ulist.np/get
  - 核心必填的参数有2个:
    - secids是股票代码,可以多选,例如`0.000001,0.000002`.前缀`0`含义如下:
      - 0=深市(含主板000、中小板002、创业板300)
      - 1=沪市（主板600/601/603、科创板688） 
      - 2=指数（如2.000001= 上证指数）
    - fields是需要返回的内容,整理如下:
      | 参数 | 含义 |
      | :---: | :---:
      | f1 | 昨收(已废弃,返回错误值) |
      | f2 | 最新价 |
      | f3 | 涨跌幅 |
      | f4 | 涨跌额 |
      | f5 | 成交量（手） |
      | f6 | 成交额（万元） |
      | f7 | 振幅 |
      | f8 | 换手率 |
      | f9 | 市盈 TTM |
      | f10 | 量比 |
      | f11 | 市盈 TTM |
      | f12 | 代码 |
      | f13 | 未知 |
      | f14 | 名称 |
      | f15 | 今开 |
      | f16 | 最低 |
      | f17 | 最高 |
      | f18 | 昨收（正确值，替代f1） |
      | f19 | 总市值 |
      | f20 | 流通市值 |
      | f21 | 委比 |
      | f22 | 市净率 |

* 获取股票分线/日线/周线/月线
  - 接口`http://push2his.eastmoney.com/api/qt/stock/kline/get`
  - 参数
    - secid 股票代码,例如 0.000001
    - fields1 基础字段1,是固定值f1,f2,f3,f4,f5,f6.
    - klt 数据类型 1=分钟线 101=日线 102周线 103月线
    - fqt 复权类型 0=不复权 1=前复权 2=后复权
    - fields2  基础字段2,是固定值f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61.含义:f51：日期 f52：开盘价 f53：收盘价 f54：最高价 f55：最低价 f56：成交量 f57：成交额 f58：振幅 f59：下跌百分比 f60：涨跌百分比 f61：涨跌金额 ‌
    - beg 开始时间 例如:20250810
    - end 结束时间 例如:20250818,通常是今日
  开始时间是需要计算的,如果klt=1,beg就是今日,klt=101,beg是60日前,klt=102,beg是60周前,klt=103,beg是60月前.

* 获取历年股东数量
  - 接口 `https://www.shidaotec.com/api/company/getHoldNumHis`
  - 参数 stockCode=000001

* 获取公司信息接口
  - 接口 `https://www.shidaotec.com/api/company/getCompanyBasic?`
  - 参数 stockCode=000001
  - 返回内容:
    ```json
    {

      "industryName": "出版", // 所属行业
      // 主题概念
      "thsIndexList": [ 
        {
          "indexName": "中字头股票",
        },
        {
          "indexName": "中特估100",
        }
      ],
      "mainBusiness": "出版物进口(54.77%)、图书类(34.97%)、期刊类(8.07%)", // 主营构成
      "actName": "中国科学院控股有限公司", // 实际控制人
      "shareHolder": "中国科技出版传媒集团有限公司(74.4%)、电子工业出版社有限公司(3.66%)、人民邮电出版社有限公司(3.6%)", // 公司股东
      "holderNumber": "43821", // 股东人数
      "top10HoldersRatio": "82.75", // 十大流通股东占比
    }
    ```
* 获取公司每年指标数据
  - 接口 `https://www.shidaotec.com/api/company/getKeyIndexOverview`
  - 参数 stockCode=000001
  - 返回内容
  ```json
  {
    // 获取股息率
    "dividendHis": [
      {
        "year": "2017",
        "cashDivr": "1.65", // 分红率 显示为 1.65%
        "cashDivPr": "37.91", // 支付率 显示 37.91%
      }
    ],
    // 营业总收入及增速
    "revenueHis": [
      {
        "revenue": "20.1", // 全年营业总收入,单位亿
        "yoy": "11.85", // 同比增长 11.85%
        "yoyIndustry": "12.49", // 行业平均 12.48%
        "year": "2017", // 年份
        // 季度营收列表,最大长度是4,也就是Q1到Q4
        "quarterList": [
          {
            "quarter": "Q1", 
            "quarterValue": "2.73", // 营业总收入
            "quarterYoy": "26.49" // 同步增长
          }
        ]

      }
    ],
    // 扣非净利润及增速
    "profitDedtHis": [
      {
        "profitDedt": "20.1", // 全年扣非净利润,单位亿
        "yoy": "11.85", // 同比增长 11.85%
        "yoyIndustry": "12.49", // 行业平均 12.48%
        "year": "2017", // 年份
        // 季度营收列表,最大长度是4,也就是Q1到Q4
        "quarterList": [
          {
            "quarter": "Q1", 
            "quarterValue": "2.73", // 扣非净利润
            "quarterYoy": "26.49" // 同步增长
          }
        ]

      }
    ],
  }
  ```

* 获取历年股东人数
  - 接口 `https://www.shidaotec.com/api/company/getHoldNumHis`
  - 参数 stockCode=000001
  - 返回内容:
    ```json
    [
      {
        "countYear": "2013",
        "holdNums": "24374"
      }
    ]
    ```

## 数据库的表和字段

- buddy 伙伴表
  | 字段    | 含义 | 类型 |
  | :---:   | :---: | 
  | name    | 名称 | text |
  | avatar  | 头像的url地址 | text |
  | money  | 金额(单位分) | int4 |
  | heldUnit | 持有的股票份额(保留小数点4位) | float4 |
  <!-- | heldUnitStatus | 持有份额状态(0=待确认,1=已确认) | int2 | -->

- money 资产表
  | 字段    | 含义 | 类型 |
  | :---:   | :---: | 
  | money   | 资产(单位分) | int4 |
  | usedMoney  | 使用中的资金,也就是持仓金额(单位分) | int4 |

- position 持仓表
  | 字段    | 含义 | 类型 |
  | :---:   | :---: | 
  | stock    | 股票code | text |
  | invt    | 市场类型 | market_type sz或sh |
  | name    | 股票名称 | text |
  | cost   | 成本 | float4 |
  | quantity  | 持股数量 | int4 |
  | update

- track 持仓操作表
  每次加仓或减仓都会生成一条数据.
  | 字段    | 含义 | 类型 |
  | :---:   | :---: | 
  | stock    | 股票code | text |
  | invt    | 市场类型 | market_type sz或sh |
  | name    | 股票名称 | text |
  | money   | 操作金额(单位:分) | int4 |
  | price  | 股票价格(单位:分) | float4 |
  | num  | 股票数量 | int4 |
  | track_type  | 操作类型(increase加仓或reduce减仓) | track_type  |

- buddyOrder 伙伴订单表
  每次拉入新伙伴或者已有伙伴加仓或减仓都会生成一条数据.
  | 字段    | 含义 | 类型 |
  | :---:   | :---: | :---: |
  | money   | 操作金额(单位:分) | int4 |
  | heldUnitStatus | 持有份额状态(0=待确认,1=已确认,2=份额不足) | int2 |
  | track_type  | 操作类型(increase加仓或reduce减仓) | track_type  |
  | buddyId  | 关联的伙伴Id | int4 |
  
- dividend
  每次在进入股票详情时,都会请求股票数据接口,把历年分红最近一年(不包含今年)存进去.
  | 字段    | 含义 | 类型 |
  | :---:   | :---: | :---: |
  | stock   | 股票代码 | text |
  | num   | 股票代码 | 最近一年的分红率的值 |
  | year   | 年份 | text |

- unit 份额表 这表只有一条数据,total是固定值100000(这个不会被更改),buddy伙伴可以购买份额,held就是被购买走了的份额.

- watchlist 关注持仓表
  每次拉入新伙伴或者已有伙伴加仓或减仓都会生成一条数据.
  | 字段    | 含义 | 类型 |
  | :---:   | :---: | :---: |
  | stock    | 股票code | text |
  | invt    | 市场类型 | market_type sz或sh |
  | price    | 关注时的最新价(单位分) | int4 |

## 伙伴份额分配逻辑

当拉入伙伴时，根据以下逻辑处理：

1. **前端操作**（拉入伙伴时）：
   - 插入 buddy 表：`heldUnit = 0`（待确认）
   - 创建 buddyOrder 记录：`heldUnitStatus = 0`（待确认），`track_type = 'increase'`
   - 显示提示："添加伙伴成功，份额将在次日确认"
   - **不检查份额充足**，不更新 unit 表

2. **后端处理**（定时任务）：
   - **份额价格计算**：份额价格 = (money表的money + usedMoney) / 100000
   - **应有份额计算**：应有份额 = 伙伴资产 / 份额价格（保留4位小数）
   - **份额检查**：
     - 如果 held + 应有份额 > total：
       - heldUnitStatus = 2（份额不足）
       - buddy.heldUnit = 0
       - 不更新 unit 表
     - 如果 held + 应有份额 ≤ total：
       - heldUnitStatus = 1（已确认）
       - buddy.heldUnit = 应有份额
       - 更新 unit 表的 held 值

3. **定时任务**：
   - `update-used-money`: 工作日下午 3:01 更新 usedMoney（持仓市值）
   - `confirm-buddy-orders`: 工作日次日凌晨 00:01 确认前一天的待确认订单（heldUnitStatus = 0 → 1 或 2）
  