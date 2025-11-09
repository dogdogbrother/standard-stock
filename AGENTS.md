## 项目简介
本项目是移动端项目

## 样式
能用到vant-ui的都使用vant-ui

## 数据库
用的supabase

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
  - GP-A是股票的意思,我们只看GP-A的数据.
    
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
      | f1 | 昨收 |
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
      | f18 | 昨收（重复 f1） |
      | f19 | 总市值 |
      | f20 | 流通市值 |
      | f21 | 委比 |
      | f22 | 市净率 |

## 数据库的表和字段

- buddy 伙伴表
  | 字段    | 含义 | 类型 |
  | :---:   | :---: | 
  | name    | 名称 | text |
  | money   | 资产 | int4 |
  | avatar  | 头像的url地址 | text |

- money 资产表,表里只有一个数据,代表我们账户的资产的剩余金额.

- position 持仓表
  | 字段    | 含义 | 类型 |
  | :---:   | :---: | 
  | stock    | 股票code | text |
  | name    | 股票名称 | text |
  | cost   | 成本 | int4 |
  | quantity  | 持股数量 | text |